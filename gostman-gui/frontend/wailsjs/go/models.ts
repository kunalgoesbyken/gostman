export namespace engine {
	
	export class OAuth2 {
	    grant: string;
	    authUrl: string;
	    tokenUrl: string;
	    clientId: string;
	    clientSecret: string;
	    scope: string;
	    username: string;
	    password: string;
	    callbackUrl: string;
	    credentialsIn: string;
	    pkce: boolean;
	    headerPrefix: string;
	    accessToken: string;
	    refreshToken: string;
	    expiresAt: number;
	
	    static createFrom(source: any = {}) {
	        return new OAuth2(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.grant = source["grant"];
	        this.authUrl = source["authUrl"];
	        this.tokenUrl = source["tokenUrl"];
	        this.clientId = source["clientId"];
	        this.clientSecret = source["clientSecret"];
	        this.scope = source["scope"];
	        this.username = source["username"];
	        this.password = source["password"];
	        this.callbackUrl = source["callbackUrl"];
	        this.credentialsIn = source["credentialsIn"];
	        this.pkce = source["pkce"];
	        this.headerPrefix = source["headerPrefix"];
	        this.accessToken = source["accessToken"];
	        this.refreshToken = source["refreshToken"];
	        this.expiresAt = source["expiresAt"];
	    }
	}
	export class Auth {
	    type: string;
	    username: string;
	    password: string;
	    token: string;
	    key: string;
	    value: string;
	    in: string;
	    oauth2: OAuth2;
	
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
	        this.oauth2 = this.convertValues(source["oauth2"], OAuth2);
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
	export class CookieInfo {
	    name: string;
	    value: string;
	    domain: string;
	    path: string;
	    expires: string;
	    secure: boolean;
	    httpOnly: boolean;
	    hostOnly: boolean;
	    expired: boolean;
	
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
	        this.hostOnly = source["hostOnly"];
	        this.expired = source["expired"];
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
	    cookies: CookieInfo[];
	
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
	        this.cookies = this.convertValues(source["cookies"], CookieInfo);
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
	    protocol?: string;
	
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
	        this.protocol = source["protocol"];
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
	export class Token {
	    accessToken: string;
	    refreshToken: string;
	    expiresAt: number;
	    error: string;
	
	    static createFrom(source: any = {}) {
	        return new Token(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.accessToken = source["accessToken"];
	        this.refreshToken = source["refreshToken"];
	        this.expiresAt = source["expiresAt"];
	        this.error = source["error"];
	    }
	}
	export class TokenExchange {
	    config: OAuth2;
	    variables: string;
	    options: Options;
	    code: string;
	    codeVerifier: string;
	    redirectUri: string;
	    refresh: boolean;
	
	    static createFrom(source: any = {}) {
	        return new TokenExchange(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.config = this.convertValues(source["config"], OAuth2);
	        this.variables = source["variables"];
	        this.options = this.convertValues(source["options"], Options);
	        this.code = source["code"];
	        this.codeVerifier = source["codeVerifier"];
	        this.redirectUri = source["redirectUri"];
	        this.refresh = source["refresh"];
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
	
	export class AuthorizationResult {
	    code: string;
	    codeVerifier: string;
	    redirectUri: string;
	
	    static createFrom(source: any = {}) {
	        return new AuthorizationResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.code = source["code"];
	        this.codeVerifier = source["codeVerifier"];
	        this.redirectUri = source["redirectUri"];
	    }
	}
	export class CertificateFiles {
	    host: string;
	    certFile: string;
	    keyFile: string;
	
	    static createFrom(source: any = {}) {
	        return new CertificateFiles(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.host = source["host"];
	        this.certFile = source["certFile"];
	        this.keyFile = source["keyFile"];
	    }
	}
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
	export class MockState {
	    running: boolean;
	    address: string;
	    routes: mock.Route[];
	
	    static createFrom(source: any = {}) {
	        return new MockState(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.running = source["running"];
	        this.address = source["address"];
	        this.routes = this.convertValues(source["routes"], mock.Route);
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
	export class RecentWorkspace {
	    path: string;
	    name: string;
	
	    static createFrom(source: any = {}) {
	        return new RecentWorkspace(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.name = source["name"];
	    }
	}
	export class Request {
	    id: string;
	    name: string;
	    description: string;
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
	    assertions: string;
	    examples: string;
	    preScript: string;
	    postScript: string;
	    grpcMethod: string;
	    grpcMessage: string;
	    grpcProtos: string;
	    timestamp: string;
	
	    static createFrom(source: any = {}) {
	        return new Request(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.description = source["description"];
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
	        this.assertions = source["assertions"];
	        this.examples = source["examples"];
	        this.preScript = source["preScript"];
	        this.postScript = source["postScript"];
	        this.grpcMethod = source["grpcMethod"];
	        this.grpcMessage = source["grpcMessage"];
	        this.grpcProtos = source["grpcProtos"];
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
	export class Settings {
	    proxyMode: string;
	    proxyUrl: string;
	    proxyBypass: string;
	    certificates: CertificateFiles[];
	    caFile: string;
	
	    static createFrom(source: any = {}) {
	        return new Settings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.proxyMode = source["proxyMode"];
	        this.proxyUrl = source["proxyUrl"];
	        this.proxyBypass = source["proxyBypass"];
	        this.certificates = this.convertValues(source["certificates"], CertificateFiles);
	        this.caFile = source["caFile"];
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
	    cookies: engine.CookieInfo[];
	    settings: Settings;
	    restricted?: boolean;
	
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
	        this.cookies = this.convertValues(source["cookies"], engine.CookieInfo);
	        this.settings = this.convertValues(source["settings"], Settings);
	        this.restricted = source["restricted"];
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
	
	export class WorkspaceStatus {
	    path: string;
	    name: string;
	    recent: RecentWorkspace[];
	    problems: workspace.Problem[];
	    notice: string;
	
	    static createFrom(source: any = {}) {
	        return new WorkspaceStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.name = source["name"];
	        this.recent = this.convertValues(source["recent"], RecentWorkspace);
	        this.problems = this.convertValues(source["problems"], workspace.Problem);
	        this.notice = source["notice"];
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

export namespace mock {
	
	export class Route {
	    requestId: string;
	    name: string;
	    method: string;
	    path: string;
	    state: string;
	    reason: string;
	    exampleId: string;
	    exampleName: string;
	
	    static createFrom(source: any = {}) {
	        return new Route(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.requestId = source["requestId"];
	        this.name = source["name"];
	        this.method = source["method"];
	        this.path = source["path"];
	        this.state = source["state"];
	        this.reason = source["reason"];
	        this.exampleId = source["exampleId"];
	        this.exampleName = source["exampleName"];
	    }
	}
	export class Settings {
	    port: number;
	    delayMs: number;
	    cors: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Settings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.port = source["port"];
	        this.delayMs = source["delayMs"];
	        this.cors = source["cors"];
	    }
	}
	export class Source {
	    id: string;
	    name: string;
	    method: string;
	    url: string;
	    examples: string;
	    exampleId: string;
	
	    static createFrom(source: any = {}) {
	        return new Source(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.method = source["method"];
	        this.url = source["url"];
	        this.examples = source["examples"];
	        this.exampleId = source["exampleId"];
	    }
	}

}

export namespace rpc {
	
	export class ProtoFile {
	    name: string;
	    content: string;
	
	    static createFrom(source: any = {}) {
	        return new ProtoFile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.content = source["content"];
	    }
	}
	export class Target {
	    address: string;
	    headers: string;
	    auth: engine.Auth;
	    variables: string;
	    options: engine.Options;
	    protos: ProtoFile[];
	
	    static createFrom(source: any = {}) {
	        return new Target(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.address = source["address"];
	        this.headers = source["headers"];
	        this.auth = this.convertValues(source["auth"], engine.Auth);
	        this.variables = source["variables"];
	        this.options = this.convertValues(source["options"], engine.Options);
	        this.protos = this.convertValues(source["protos"], ProtoFile);
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
	export class Call {
	    target: Target;
	    method: string;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new Call(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.target = this.convertValues(source["target"], Target);
	        this.method = source["method"];
	        this.message = source["message"];
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
	export class Method {
	    name: string;
	    fullName: string;
	    inputType: string;
	    outputType: string;
	    clientStreaming: boolean;
	    serverStreaming: boolean;
	    skeleton: string;
	
	    static createFrom(source: any = {}) {
	        return new Method(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.fullName = source["fullName"];
	        this.inputType = source["inputType"];
	        this.outputType = source["outputType"];
	        this.clientStreaming = source["clientStreaming"];
	        this.serverStreaming = source["serverStreaming"];
	        this.skeleton = source["skeleton"];
	    }
	}
	
	export class Service {
	    name: string;
	    methods: Method[];
	
	    static createFrom(source: any = {}) {
	        return new Service(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.methods = this.convertValues(source["methods"], Method);
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
	export class Schema {
	    source: string;
	    services: Service[];
	
	    static createFrom(source: any = {}) {
	        return new Schema(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.source = source["source"];
	        this.services = this.convertValues(source["services"], Service);
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

export namespace workspace {
	
	export class Problem {
	    path: string;
	    line: number;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new Problem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.line = source["line"];
	        this.message = source["message"];
	    }
	}

}

