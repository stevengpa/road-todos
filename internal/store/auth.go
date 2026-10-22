package store

import (
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
	"time"

	"road-todo/internal/auth"
	"road-todo/internal/models"
)

var (
	ErrUserExists    = errors.New("user already exists")
	ErrInvalidLogin  = errors.New("invalid username or password")
	ErrInvalidSession = errors.New("invalid session")
)

func authNow() string { return time.Now().UTC().Format(time.RFC3339) }
func sessionExpiry() string { return time.Now().UTC().Add(7 * 24 * time.Hour).Format(time.RFC3339) }

func (s *Store) CreateUser(username, password string) (models.User, error) {
	username = strings.TrimSpace(username)
	if username == "" || password == "" {
		return models.User{}, fmt.Errorf("username and password required")
	}
	hash, err := auth.HashPassword(password)
	if err != nil {
		return models.User{}, err
	}
	ts := authNow()
	res, err := s.db.Exec(`INSERT INTO users (username, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?)`, username, hash, ts, ts)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE") {
			return models.User{}, ErrUserExists
		}
		return models.User{}, err
	}
	id, _ := res.LastInsertId()
	return s.getUser(id)
}

func (s *Store) getUser(id int64) (models.User, error) {
	var u models.User
	err := s.db.QueryRow(`SELECT id, username, created_at, updated_at FROM users WHERE id = ?`, id).Scan(&u.ID, &u.Username, &u.CreatedAt, &u.UpdatedAt)
	return u, err
}

func (s *Store) getUserByUsername(username string) (models.User, string, error) {
	var u models.User
	var hash string
	err := s.db.QueryRow(`SELECT id, username, password_hash, created_at, updated_at FROM users WHERE username = ?`, username).Scan(&u.ID, &u.Username, &hash, &u.CreatedAt, &u.UpdatedAt)
	return u, hash, err
}

func (s *Store) Login(username, password string) (models.User, string, error) {
	username = strings.TrimSpace(username)
	u, hash, err := s.getUserByUsername(username)
	if err != nil {
		if err == sql.ErrNoRows {
			return models.User{}, "", ErrInvalidLogin
		}
		return models.User{}, "", err
	}
	ok, err := auth.VerifyPassword(password, hash)
	if err != nil || !ok {
		return models.User{}, "", ErrInvalidLogin
	}
	sess, err := s.CreateSession(u.ID)
	if err != nil {
		return models.User{}, "", err
	}
	return u, sess, nil
}

func (s *Store) CreateSession(userID int64) (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	token := base64.RawURLEncoding.EncodeToString(b)
	_, err := s.db.Exec(`INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`, token, userID, sessionExpiry(), authNow())
	if err != nil {
		return "", err
	}
	return token, nil
}

func (s *Store) GetUserBySession(token string) (*models.User, error) {
	if token == "" {
		return nil, ErrInvalidSession
	}
	var userID int64
	var expires string
	err := s.db.QueryRow(`SELECT user_id, expires_at FROM sessions WHERE id = ?`, token).Scan(&userID, &expires)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrInvalidSession
		}
		return nil, err
	}
	if expires < authNow() {
		s.db.Exec(`DELETE FROM sessions WHERE id = ?`, token)
		return nil, ErrInvalidSession
	}
	u, err := s.getUser(userID)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (s *Store) Logout(token string) error {
	_, err := s.db.Exec(`DELETE FROM sessions WHERE id = ?`, token)
	return err
}

func (s *Store) DeleteUser(userID int64) error {
	// Delete in order due to foreign keys; ON DELETE CASCADE should handle most
	_, err := s.db.Exec(`DELETE FROM users WHERE id = ?`, userID)
	return err
}
