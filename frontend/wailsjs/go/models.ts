export namespace models {
	
	export class Board {
	    id: number;
	    userId: number;
	    name: string;
	    description: string;
	    color: string;
	    createdAt: string;
	    updatedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new Board(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.userId = source["userId"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.color = source["color"];
	        this.createdAt = source["createdAt"];
	        this.updatedAt = source["updatedAt"];
	    }
	}
	export class BoardInput {
	    id: number;
	    name: string;
	    description: string;
	    color: string;
	
	    static createFrom(source: any = {}) {
	        return new BoardInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.color = source["color"];
	    }
	}
	export class BoardView {
	    boardId: number;
	    view: string;
	
	    static createFrom(source: any = {}) {
	        return new BoardView(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.boardId = source["boardId"];
	        this.view = source["view"];
	    }
	}
	export class Card {
	    id: number;
	    boardId: number;
	    columnId: number;
	    userId: number;
	    title: string;
	    description: string;
	    priority: string;
	    completed: boolean;
	    dueDate: string;
	    remindAt: string;
	    remindBefore: number;
	    tags: string;
	    recurrence: string;
	    recurInterval: number;
	    recurUnit: string;
	    position: number;
	    createdAt: string;
	    updatedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new Card(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.boardId = source["boardId"];
	        this.columnId = source["columnId"];
	        this.userId = source["userId"];
	        this.title = source["title"];
	        this.description = source["description"];
	        this.priority = source["priority"];
	        this.completed = source["completed"];
	        this.dueDate = source["dueDate"];
	        this.remindAt = source["remindAt"];
	        this.remindBefore = source["remindBefore"];
	        this.tags = source["tags"];
	        this.recurrence = source["recurrence"];
	        this.recurInterval = source["recurInterval"];
	        this.recurUnit = source["recurUnit"];
	        this.position = source["position"];
	        this.createdAt = source["createdAt"];
	        this.updatedAt = source["updatedAt"];
	    }
	}
	export class CardInput {
	    id: number;
	    boardId: number;
	    columnId: number;
	    title: string;
	    description: string;
	    priority: string;
	    dueDate: string;
	    remindAt: string;
	    remindBefore: number;
	    tags: string;
	    recurrence: string;
	    recurInterval: number;
	    recurUnit: string;
	
	    static createFrom(source: any = {}) {
	        return new CardInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.boardId = source["boardId"];
	        this.columnId = source["columnId"];
	        this.title = source["title"];
	        this.description = source["description"];
	        this.priority = source["priority"];
	        this.dueDate = source["dueDate"];
	        this.remindAt = source["remindAt"];
	        this.remindBefore = source["remindBefore"];
	        this.tags = source["tags"];
	        this.recurrence = source["recurrence"];
	        this.recurInterval = source["recurInterval"];
	        this.recurUnit = source["recurUnit"];
	    }
	}
	export class Column {
	    id: number;
	    boardId: number;
	    name: string;
	    color: string;
	    position: number;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new Column(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.boardId = source["boardId"];
	        this.name = source["name"];
	        this.color = source["color"];
	        this.position = source["position"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class ColumnInput {
	    id: number;
	    boardId: number;
	    name: string;
	    color: string;
	
	    static createFrom(source: any = {}) {
	        return new ColumnInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.boardId = source["boardId"];
	        this.name = source["name"];
	        this.color = source["color"];
	    }
	}
	export class Reminder {
	    id: number;
	    boardId: number;
	    columnId: number;
	    title: string;
	    kind: string;
	    dueDate: string;
	    remindAt: string;
	    overdue: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Reminder(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.boardId = source["boardId"];
	        this.columnId = source["columnId"];
	        this.title = source["title"];
	        this.kind = source["kind"];
	        this.dueDate = source["dueDate"];
	        this.remindAt = source["remindAt"];
	        this.overdue = source["overdue"];
	    }
	}
	export class Settings {
	    theme: string;
	    showCompleted: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Settings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.theme = source["theme"];
	        this.showCompleted = source["showCompleted"];
	    }
	}
	export class User {
	    id: number;
	    username: string;
	    createdAt: string;
	    updatedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new User(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.username = source["username"];
	        this.createdAt = source["createdAt"];
	        this.updatedAt = source["updatedAt"];
	    }
	}
	export class Snapshot {
	    user?: User;
	    boards: Board[];
	    columns: Column[];
	    cards: Card[];
	
	    static createFrom(source: any = {}) {
	        return new Snapshot(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.user = this.convertValues(source["user"], User);
	        this.boards = this.convertValues(source["boards"], Board);
	        this.columns = this.convertValues(source["columns"], Column);
	        this.cards = this.convertValues(source["cards"], Card);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

