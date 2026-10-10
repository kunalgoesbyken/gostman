export namespace engine {
	
	export class Auth {
	    type: string;
	    username: string;
	    password: string;
	    token: string;
	    key: string;
	    value: string;
	    in: string;
	
	    static createFrom(source: any = {}) {
	        return new Auth(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.username = source["username"];
	        this.password = source["password"];
	        this.token = source["token"];
	        this.key = source["key"];
	        this.value = source["value"];
	        this.in = source["in"];
	    }
	}
	export class CookieInfo {
	    name: string;
	    value: string;
	    domain: string;
	    path: string;
	    expires: string;
	    secure: boolean;
	    httpOnly: boolean;
	
	    static createFrom(source: any = {}) {
	        return new CookieInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.value = source["value"];
	        this.domain = source["domain"];
	        this.path = source["path"];
	        this.expires = source["expires"];
	        this.secure = source["secure"];
	        this.httpOnly = source["httpOnly"];
	    }
	}
	export class HeaderEntry {
	    key: string;
	    value: string;
	
	    static createFrom(source: any = {}) {
	        return new HeaderEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.key = source["key"];
	        this.value = source["value"];
	    }
	}
	export class Options {
	    timeoutMs: number;
	    noFollowRedirects: boolean;
	    insecureTLS: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Options(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.timeoutMs = source["timeoutMs"];
	        this.noFollowRedirects = source["noFollowRedirects"];
	        this.insecureTLS = source["insecureTLS"];
	    }
	}
	export class Prepared {
	    method: string;
	    url: string;
	    headers: HeaderEntry[];
	    body: string;
	
	    static createFrom(source: any = {}) {
	        return new Prepared(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.method = source["method"];
	        this.url = source["url"];
	        this.headers = this.convertValues(source["headers"], HeaderEntry);
	        this.body = source["body"];
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
	export class Request {
	    method: string;
	    url: string;
	    headers: string;
	    queryParams: string;
	    body: string;
	    bodyType: string;
	    graphqlQuery: string;
	    graphqlVariables: string;
	    auth: Auth;
	    variables: string;
	    options: Options;
	
	    static createFrom(source: any = {}) {
	        return new Request(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.method = source["method"];
	        this.url = source["url"];
	        this.headers = source["headers"];
	        this.queryParams = source["queryParams"];
	        this.body = source["body"];
	        this.bodyType = source["bodyType"];
	        this.graphqlQuery = source["graphqlQuery"];
	        this.graphqlVariables = source["graphqlVariables"];
	        this.auth = this.convertValues(source["auth"], Auth);
	        this.variables = source["variables"];
	        this.options = this.convertValues(source["options"], Options);
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
	export class Response {
	    status: string;
	    statusCode: number;
	    headers: HeaderEntry[];
	    cookies: CookieInfo[];
	    body: string;
	    bodyEncoding: string;
	    contentType: string;
	    size: number;
	    durationMs: number;
	    url: string;
	    truncated: boolean;
	    error: string;
	
	    static createFrom(source: any = {}) {
	        return new Response(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.status = source["status"];
	        this.statusCode = source["statusCode"];
	        this.headers = this.convertValues(source["headers"], HeaderEntry);
	        this.cookies = this.convertValues(source["cookies"], CookieInfo);
	        this.body = source["body"];
	        this.bodyEncoding = source["bodyEncoding"];
	        this.contentType = source["contentType"];
	        this.size = source["size"];
	        this.durationMs = source["durationMs"];
	        this.url = source["url"];
	        this.truncated = source["truncated"];
	        this.error = source["error"];
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

export namespace main {
	
	export class Environment {
	    id: string;
	    name: string;
	    variables: string;
	
	    static createFrom(source: any = {}) {
	        return new Environment(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.variables = source["variables"];
	    }
	}
	export class Folder {
	    id: string;
	    name: string;
	    isOpen: boolean;
	    parentId: string;
	
	    static createFrom(source: any = {}) {
	        return new Folder(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.isOpen = source["isOpen"];
	        this.parentId = source["parentId"];
	    }
	}
	export class Request {
	    id: string;
	    name: string;
	    url: string;
	    method: string;
	    headers: string;
	    body: string;
	    bodyType: string;
	    queryParams: string;
	    folderId: string;
	    graphqlQuery: string;
	    graphqlVariables: string;
	    auth: engine.Auth;
	    options: engine.Options;
	    extractors: string;
	    timestamp: string;
	
	    static createFrom(source: any = {}) {
	        return new Request(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.url = source["url"];
	        this.method = source["method"];
	        this.headers = source["headers"];
	        this.body = source["body"];
	        this.bodyType = source["bodyType"];
	        this.queryParams = source["queryParams"];
	        this.folderId = source["folderId"];
	        this.graphqlQuery = source["graphqlQuery"];
	        this.graphqlVariables = source["graphqlVariables"];
	        this.auth = this.convertValues(source["auth"], engine.Auth);
	        this.options = this.convertValues(source["options"], engine.Options);
	        this.extractors = source["extractors"];
	        this.timestamp = source["timestamp"];
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
	export class SavedData {
	    variables?: string;
	    environments: Environment[];
	    activeEnvironmentId: string;
	    requests: Request[];
	    folders: Folder[];
	    history: Request[];
	
	    static createFrom(source: any = {}) {
	        return new SavedData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.variables = source["variables"];
	        this.environments = this.convertValues(source["environments"], Environment);
	        this.activeEnvironmentId = source["activeEnvironmentId"];
	        this.requests = this.convertValues(source["requests"], Request);
	        this.folders = this.convertValues(source["folders"], Folder);
	        this.history = this.convertValues(source["history"], Request);
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

