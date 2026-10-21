export namespace ai {
	
	export class Config {
	    provider: string;
	    baseUrl: string;
	    model: string;
	    allowInsecure: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Config(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.provider = source["provider"];
	        this.baseUrl = source["baseUrl"];
	        this.model = source["model"];
	        this.allowInsecure = source["allowInsecure"];
	    }
	}
	export class Error {
	    kind: string;
	    status: number;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new Error(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.kind = source["kind"];
	        this.status = source["status"];
	        this.message = source["message"];
	    }
	}
	export class Prompt {
	    system: string;
	    user: string;
	
	    static createFrom(source: any = {}) {
	        return new Prompt(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.system = source["system"];
	        this.user = source["user"];
	    }
	}

}

export namespace capture {
	
	export class Message {
	    headers: engine.HeaderEntry[];
	    body: string;
	    bodyEncoding: string;
	    contentType: string;
	    size: number;
	    truncated: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Message(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.headers = this.convertValues(source["headers"], engine.HeaderEntry);
	        this.body = source["body"];
	        this.bodyEncoding = source["bodyEncoding"];
	        this.contentType = source["contentType"];
	        this.size = source["size"];
	        this.truncated = source["truncated"];
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
	export class Exchange {
	    id: number;
	    // Go type: time
	    time: any;
	    method: string;
	    path: string;
	    url: string;
	    request: Message;
	    status: number;
	    response: Message;
	    durationMs: number;
	    upgraded: boolean;
	    interrupted: boolean;
	    error: string;
	
	    static createFrom(source: any = {}) {
	        return new Exchange(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.time = this.convertValues(source["time"], null);
	        this.method = source["method"];
	        this.path = source["path"];
	        this.url = source["url"];
	        this.request = this.convertValues(source["request"], Message);
	        this.status = source["status"];
	        this.response = this.convertValues(source["response"], Message);
	        this.durationMs = source["durationMs"];
	        this.upgraded = source["upgraded"];
	        this.interrupted = source["interrupted"];
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
	
	export class Settings {
	    upstream: string;
	    port: number;
	
	    static createFrom(source: any = {}) {
	        return new Settings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.upstream = source["upstream"];
	        this.port = source["port"];
	    }
	}

}

export namespace deeplink {
	
	export class Reply {
	    file: importer.File;
	    host?: string;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new Reply(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.file = this.convertValues(source["file"], importer.File);
	        this.host = source["host"];
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

export namespace engine {
	
	export class AWSAuth {
	    accessKey: string;
	    secretKey: string;
	    sessionToken: string;
	    region: string;
	    service: string;
	
	    static createFrom(source: any = {}) {
	        return new AWSAuth(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.accessKey = source["accessKey"];
	        this.secretKey = source["secretKey"];
	        this.sessionToken = source["sessionToken"];
	        this.region = source["region"];
	        this.service = source["service"];
	    }
	}
	export class EdgeGridAuth {
	    clientToken: string;
	    clientSecret: string;
	    accessToken: string;
	    nonce: string;
	    timestamp: string;
	    headersToSign: string;
	    maxBody: string;
	
	    static createFrom(source: any = {}) {
	        return new EdgeGridAuth(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.clientToken = source["clientToken"];
	        this.clientSecret = source["clientSecret"];
	        this.accessToken = source["accessToken"];
	        this.nonce = source["nonce"];
	        this.timestamp = source["timestamp"];
	        this.headersToSign = source["headersToSign"];
	        this.maxBody = source["maxBody"];
	    }
	}
	export class OAuth1Auth {
	    consumerKey: string;
	    consumerSecret: string;
	    token: string;
	    tokenSecret: string;
	    signatureMethod: string;
	    privateKey: string;
	    realm: string;
	    callback: string;
	    verifier: string;
	    nonce: string;
	    timestamp: string;
	    in: string;
	
	    static createFrom(source: any = {}) {
	        return new OAuth1Auth(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.consumerKey = source["consumerKey"];
	        this.consumerSecret = source["consumerSecret"];
	        this.token = source["token"];
	        this.tokenSecret = source["tokenSecret"];
	        this.signatureMethod = source["signatureMethod"];
	        this.privateKey = source["privateKey"];
	        this.realm = source["realm"];
	        this.callback = source["callback"];
	        this.verifier = source["verifier"];
	        this.nonce = source["nonce"];
	        this.timestamp = source["timestamp"];
	        this.in = source["in"];
	    }
	}
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
	    domain: string;
	    aws: AWSAuth;
	    oauth1: OAuth1Auth;
	    edgegrid: EdgeGridAuth;
	
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
	        this.domain = source["domain"];
	        this.aws = this.convertValues(source["aws"], AWSAuth);
	        this.oauth1 = this.convertValues(source["oauth1"], OAuth1Auth);
	        this.edgegrid = this.convertValues(source["edgegrid"], EdgeGridAuth);
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
	export class Phases {
	    dnsMs: number;
	    connectMs: number;
	    tlsMs: number;
	    firstByteMs: number;
	    downloadMs: number;
	
	    static createFrom(source: any = {}) {
	        return new Phases(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.dnsMs = source["dnsMs"];
	        this.connectMs = source["connectMs"];
	        this.tlsMs = source["tlsMs"];
	        this.firstByteMs = source["firstByteMs"];
	        this.downloadMs = source["downloadMs"];
	    }
	}
	export class TLSInfo {
	    version: string;
	    cipher: string;
	    protocol?: string;
	    subject?: string;
	    issuer?: string;
	    notAfter?: string;
	
	    static createFrom(source: any = {}) {
	        return new TLSInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.version = source["version"];
	        this.cipher = source["cipher"];
	        this.protocol = source["protocol"];
	        this.subject = source["subject"];
	        this.issuer = source["issuer"];
	        this.notAfter = source["notAfter"];
	    }
	}
	export class TimelineHeader {
	    key: string;
	    value: string;
	    masked?: boolean;
	    secret?: string;
	
	    static createFrom(source: any = {}) {
	        return new TimelineHeader(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.key = source["key"];
	        this.value = source["value"];
	        this.masked = source["masked"];
	        this.secret = source["secret"];
	    }
	}
	export class Hop {
	    method: string;
	    url: string;
	    status?: number;
	    proto?: string;
	    location?: string;
	    remote?: string;
	    reused: boolean;
	    requestBytes: number;
	    sent: TimelineHeader[];
	    received: TimelineHeader[];
	    cookiesSet?: string[];
	    tls?: TLSInfo;
	    startMs: number;
	    totalMs: number;
	    phases: Phases;
	    failedPhase?: string;
	
	    static createFrom(source: any = {}) {
	        return new Hop(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.method = source["method"];
	        this.url = source["url"];
	        this.status = source["status"];
	        this.proto = source["proto"];
	        this.location = source["location"];
	        this.remote = source["remote"];
	        this.reused = source["reused"];
	        this.requestBytes = source["requestBytes"];
	        this.sent = this.convertValues(source["sent"], TimelineHeader);
	        this.received = this.convertValues(source["received"], TimelineHeader);
	        this.cookiesSet = source["cookiesSet"];
	        this.tls = this.convertValues(source["tls"], TLSInfo);
	        this.startMs = source["startMs"];
	        this.totalMs = source["totalMs"];
	        this.phases = this.convertValues(source["phases"], Phases);
	        this.failedPhase = source["failedPhase"];
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
	export class Layer {
	    headers: string;
	    auth: Auth;
	
	    static createFrom(source: any = {}) {
	        return new Layer(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.headers = source["headers"];
	        this.auth = this.convertValues(source["auth"], Auth);
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
	
	
	export class Options {
	    timeoutMs: number;
	    noFollowRedirects: boolean;
	    insecureTLS: boolean;
	    stream: boolean;
	    streamReconnect: boolean;
	    streamMaxEvents: number;
	    streamMaxSeconds: number;
	
	    static createFrom(source: any = {}) {
	        return new Options(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.timeoutMs = source["timeoutMs"];
	        this.noFollowRedirects = source["noFollowRedirects"];
	        this.insecureTLS = source["insecureTLS"];
	        this.stream = source["stream"];
	        this.streamReconnect = source["streamReconnect"];
	        this.streamMaxEvents = source["streamMaxEvents"];
	        this.streamMaxSeconds = source["streamMaxSeconds"];
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
	    inherited?: Layer[];
	
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
	        this.inherited = this.convertValues(source["inherited"], Layer);
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
	export class Timeline {
	    hops: Hop[];
	    omitted?: number;
	    totalMs: number;
	    proxied?: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Timeline(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.hops = this.convertValues(source["hops"], Hop);
	        this.omitted = source["omitted"];
	        this.totalMs = source["totalMs"];
	        this.proxied = source["proxied"];
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
	    streamEnd?: string;
	    timeline?: Timeline;
	
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
	        this.streamEnd = source["streamEnd"];
	        this.timeline = this.convertValues(source["timeline"], Timeline);
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

export namespace gitutil {
	
	export class Branch {
	    name: string;
	    current: boolean;
	    remote: boolean;
	    upstream: string;
	    short: string;
	    subject: string;
	
	    static createFrom(source: any = {}) {
	        return new Branch(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.current = source["current"];
	        this.remote = source["remote"];
	        this.upstream = source["upstream"];
	        this.short = source["short"];
	        this.subject = source["subject"];
	    }
	}
	export class Change {
	    path: string;
	    origPath: string;
	    index: string;
	    worktree: string;
	    conflict: boolean;
	    untracked: boolean;
	    kind: string;
	    summary: string[];
	
	    static createFrom(source: any = {}) {
	        return new Change(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.origPath = source["origPath"];
	        this.index = source["index"];
	        this.worktree = source["worktree"];
	        this.conflict = source["conflict"];
	        this.untracked = source["untracked"];
	        this.kind = source["kind"];
	        this.summary = source["summary"];
	    }
	}
	export class Commit {
	    hash: string;
	    short: string;
	    author: string;
	    date: string;
	    subject: string;
	
	    static createFrom(source: any = {}) {
	        return new Commit(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.hash = source["hash"];
	        this.short = source["short"];
	        this.author = source["author"];
	        this.date = source["date"];
	        this.subject = source["subject"];
	    }
	}
	export class Conflict {
	    path: string;
	    ours: string;
	    theirs: string;
	    base: string;
	    working: string;
	    oursGone: boolean;
	    theirsGone: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Conflict(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.ours = source["ours"];
	        this.theirs = source["theirs"];
	        this.base = source["base"];
	        this.working = source["working"];
	        this.oursGone = source["oursGone"];
	        this.theirsGone = source["theirsGone"];
	    }
	}
	export class Diff {
	    text: string;
	    binary: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Diff(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.text = source["text"];
	        this.binary = source["binary"];
	    }
	}
	export class Remote {
	    name: string;
	    url: string;
	
	    static createFrom(source: any = {}) {
	        return new Remote(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.url = source["url"];
	    }
	}
	export class Stash {
	    index: number;
	    message: string;
	    date: string;
	
	    static createFrom(source: any = {}) {
	        return new Stash(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.index = source["index"];
	        this.message = source["message"];
	        this.date = source["date"];
	    }
	}
	export class Version {
	    content: string;
	    diff: string;
	
	    static createFrom(source: any = {}) {
	        return new Version(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.content = source["content"];
	        this.diff = source["diff"];
	    }
	}

}

export namespace importer {
	
	export class File {
	    name: string;
	    text: string;
	
	    static createFrom(source: any = {}) {
	        return new File(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.text = source["text"];
	    }
	}
	export class Options {
	    skipStatic: boolean;
	    includeSecrets: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Options(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.skipStatic = source["skipStatic"];
	        this.includeSecrets = source["includeSecrets"];
	    }
	}
	export class Query {
	    action: string;
	    format: string;
	    files: File[];
	    options: Options;
	    collection?: workspace.Collection;
	
	    static createFrom(source: any = {}) {
	        return new Query(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.action = source["action"];
	        this.format = source["format"];
	        this.files = this.convertValues(source["files"], File);
	        this.options = this.convertValues(source["options"], Options);
	        this.collection = this.convertValues(source["collection"], workspace.Collection);
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
	export class Source {
	    name: string;
	    format: string;
	    requests: number;
	    folders: number;
	    environments: number;
	
	    static createFrom(source: any = {}) {
	        return new Source(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.format = source["format"];
	        this.requests = source["requests"];
	        this.folders = source["folders"];
	        this.environments = source["environments"];
	    }
	}
	export class Reply {
	    error?: string;
	    sources: Source[];
	    requests: workspace.Request[];
	    folders: workspace.Folder[];
	    environments: workspace.Environment[];
	    variables: Record<string, string>;
	    warnings: string[];
	    skipped: string[];
	    files?: File[];
	    archive?: string;
	
	    static createFrom(source: any = {}) {
	        return new Reply(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.error = source["error"];
	        this.sources = this.convertValues(source["sources"], Source);
	        this.requests = this.convertValues(source["requests"], workspace.Request);
	        this.folders = this.convertValues(source["folders"], workspace.Folder);
	        this.environments = this.convertValues(source["environments"], workspace.Environment);
	        this.variables = source["variables"];
	        this.warnings = source["warnings"];
	        this.skipped = source["skipped"];
	        this.files = this.convertValues(source["files"], File);
	        this.archive = source["archive"];
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

export namespace lint {
	
	export class Counts {
	    error: number;
	    warning: number;
	    info: number;
	
	    static createFrom(source: any = {}) {
	        return new Counts(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.error = source["error"];
	        this.warning = source["warning"];
	        this.info = source["info"];
	    }
	}
	export class Finding {
	    rule: string;
	    severity: string;
	    message: string;
	    path: string;
	    operation?: string;
	
	    static createFrom(source: any = {}) {
	        return new Finding(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.rule = source["rule"];
	        this.severity = source["severity"];
	        this.message = source["message"];
	        this.path = source["path"];
	        this.operation = source["operation"];
	    }
	}
	export class Query {
	    source: openapi.Source;
	    config: string;
	
	    static createFrom(source: any = {}) {
	        return new Query(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.source = this.convertValues(source["source"], openapi.Source);
	        this.config = source["config"];
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
	export class Report {
	    findings: Finding[];
	    counts: Counts;
	
	    static createFrom(source: any = {}) {
	        return new Report(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.findings = this.convertValues(source["findings"], Finding);
	        this.counts = this.convertValues(source["counts"], Counts);
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
	export class Reply {
	    error?: string;
	    report?: Report;
	
	    static createFrom(source: any = {}) {
	        return new Reply(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.error = source["error"];
	        this.report = this.convertValues(source["report"], Report);
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

export namespace loadtest {
	
	export class Bin {
	    fromMs: number;
	    toMs: number;
	    count: number;
	
	    static createFrom(source: any = {}) {
	        return new Bin(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.fromMs = source["fromMs"];
	        this.toMs = source["toMs"];
	        this.count = source["count"];
	    }
	}
	export class Config {
	    concurrency: number;
	    durationMs: number;
	    requests: number;
	    ratePerSecond: number;
	    rampMs: number;
	    failureStatus: number;
	
	    static createFrom(source: any = {}) {
	        return new Config(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.concurrency = source["concurrency"];
	        this.durationMs = source["durationMs"];
	        this.requests = source["requests"];
	        this.ratePerSecond = source["ratePerSecond"];
	        this.rampMs = source["rampMs"];
	        this.failureStatus = source["failureStatus"];
	    }
	}
	export class Latency {
	    minMs: number;
	    meanMs: number;
	    p50Ms: number;
	    p90Ms: number;
	    p95Ms: number;
	    p99Ms: number;
	    maxMs: number;
	
	    static createFrom(source: any = {}) {
	        return new Latency(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.minMs = source["minMs"];
	        this.meanMs = source["meanMs"];
	        this.p50Ms = source["p50Ms"];
	        this.p90Ms = source["p90Ms"];
	        this.p95Ms = source["p95Ms"];
	        this.p99Ms = source["p99Ms"];
	        this.maxMs = source["maxMs"];
	    }
	}
	export class Report {
	    config: Config;
	    total: number;
	    succeeded: number;
	    failed: number;
	    networkErrors: number;
	    statusFailures: number;
	    statusCodes: Record<number, number>;
	    durationMs: number;
	    requestsPerSecond: number;
	    latency: Latency;
	    bytesReceived: number;
	    errorSamples: string[];
	    distribution: Bin[];
	    stopped: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Report(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.config = this.convertValues(source["config"], Config);
	        this.total = source["total"];
	        this.succeeded = source["succeeded"];
	        this.failed = source["failed"];
	        this.networkErrors = source["networkErrors"];
	        this.statusFailures = source["statusFailures"];
	        this.statusCodes = source["statusCodes"];
	        this.durationMs = source["durationMs"];
	        this.requestsPerSecond = source["requestsPerSecond"];
	        this.latency = this.convertValues(source["latency"], Latency);
	        this.bytesReceived = source["bytesReceived"];
	        this.errorSamples = source["errorSamples"];
	        this.distribution = this.convertValues(source["distribution"], Bin);
	        this.stopped = source["stopped"];
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
	
	export class AiReply {
	    text: string;
	    error?: ai.Error;
	
	    static createFrom(source: any = {}) {
	        return new AiReply(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.text = source["text"];
	        this.error = this.convertValues(source["error"], ai.Error);
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
	export class CaptureState {
	    running: boolean;
	    address: string;
	    upstream: string;
	
	    static createFrom(source: any = {}) {
	        return new CaptureState(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.running = source["running"];
	        this.address = source["address"];
	        this.upstream = source["upstream"];
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
	    color: string;
	    extends: string;
	    meta: string;
	
	    static createFrom(source: any = {}) {
	        return new Environment(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.variables = source["variables"];
	        this.color = source["color"];
	        this.extends = source["extends"];
	        this.meta = source["meta"];
	    }
	}
	export class Folder {
	    id: string;
	    name: string;
	    isOpen: boolean;
	    parentId: string;
	    sortOrder: number;
	    variables: string;
	    description: string;
	    headers: string;
	    auth: engine.Auth;
	    preScript: string;
	    postScript: string;
	    assertions: string;
	
	    static createFrom(source: any = {}) {
	        return new Folder(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.isOpen = source["isOpen"];
	        this.parentId = source["parentId"];
	        this.sortOrder = source["sortOrder"];
	        this.variables = source["variables"];
	        this.description = source["description"];
	        this.headers = source["headers"];
	        this.auth = this.convertValues(source["auth"], engine.Auth);
	        this.preScript = source["preScript"];
	        this.postScript = source["postScript"];
	        this.assertions = source["assertions"];
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
	export class GitState {
	    installed: boolean;
	    installHint: string;
	    hasFolder: boolean;
	    isRepo: boolean;
	    problem: string;
	    restricted: boolean;
	    root: string;
	    branch: string;
	    detached: boolean;
	    upstream: string;
	    ahead: number;
	    behind: number;
	    merging: boolean;
	    hasCommits: boolean;
	    changes: gitutil.Change[];
	    remotes: gitutil.Remote[];
	
	    static createFrom(source: any = {}) {
	        return new GitState(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.installed = source["installed"];
	        this.installHint = source["installHint"];
	        this.hasFolder = source["hasFolder"];
	        this.isRepo = source["isRepo"];
	        this.problem = source["problem"];
	        this.restricted = source["restricted"];
	        this.root = source["root"];
	        this.branch = source["branch"];
	        this.detached = source["detached"];
	        this.upstream = source["upstream"];
	        this.ahead = source["ahead"];
	        this.behind = source["behind"];
	        this.merging = source["merging"];
	        this.hasCommits = source["hasCommits"];
	        this.changes = this.convertValues(source["changes"], gitutil.Change);
	        this.remotes = this.convertValues(source["remotes"], gitutil.Remote);
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
	export class MockState {
	    running: boolean;
	    address: string;
	    routes: mock.Route[];
	    log: mock.Entry[];
	
	    static createFrom(source: any = {}) {
	        return new MockState(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.running = source["running"];
	        this.address = source["address"];
	        this.routes = this.convertValues(source["routes"], mock.Route);
	        this.log = this.convertValues(source["log"], mock.Entry);
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
	export class OpenLink {
	    url: string;
	    host: string;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new OpenLink(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.url = source["url"];
	        this.host = source["host"];
	        this.error = source["error"];
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
	    mcpTool: string;
	    mcpArguments: string;
	    vars: string;
	    timestamp: string;
	    sortOrder: number;
	
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
	        this.mcpTool = source["mcpTool"];
	        this.mcpArguments = source["mcpArguments"];
	        this.vars = source["vars"];
	        this.timestamp = source["timestamp"];
	        this.sortOrder = source["sortOrder"];
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
	    globals?: Environment[];
	    activeGlobalId?: string;
	    collectionVariables?: string;
	    dotEnv?: Record<string, string>;
	    collectionSettings: workspace.Settings;
	
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
	        this.globals = this.convertValues(source["globals"], Environment);
	        this.activeGlobalId = source["activeGlobalId"];
	        this.collectionVariables = source["collectionVariables"];
	        this.dotEnv = source["dotEnv"];
	        this.collectionSettings = this.convertValues(source["collectionSettings"], workspace.Settings);
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
	export class SecretConnection {
	    alias: string;
	    kind: string;
	    values: Record<string, string>;
	    stored?: string[];
	
	    static createFrom(source: any = {}) {
	        return new SecretConnection(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.alias = source["alias"];
	        this.kind = source["kind"];
	        this.values = source["values"];
	        this.stored = source["stored"];
	    }
	}
	
	export class WorkspaceEntry {
	    path: string;
	    name: string;
	    pinned: boolean;
	    current: boolean;
	    missing: boolean;
	
	    static createFrom(source: any = {}) {
	        return new WorkspaceEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.name = source["name"];
	        this.pinned = source["pinned"];
	        this.current = source["current"];
	        this.missing = source["missing"];
	    }
	}
	export class WorkspaceStatus {
	    path: string;
	    name: string;
	    workspaces: WorkspaceEntry[];
	    problems: workspace.Problem[];
	    notice: string;
	
	    static createFrom(source: any = {}) {
	        return new WorkspaceStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.name = source["name"];
	        this.workspaces = this.convertValues(source["workspaces"], WorkspaceEntry);
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

export namespace mcp {
	
	export class Implementation {
	    name: string;
	    version: string;
	
	    static createFrom(source: any = {}) {
	        return new Implementation(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.version = source["version"];
	    }
	}

}

export namespace mcpclient {
	
	export class Target {
	    url: string;
	    headers: string;
	    inherited?: engine.Layer[];
	    auth: engine.Auth;
	    variables: string;
	    options: engine.Options;
	
	    static createFrom(source: any = {}) {
	        return new Target(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.url = source["url"];
	        this.headers = source["headers"];
	        this.inherited = this.convertValues(source["inherited"], engine.Layer);
	        this.auth = this.convertValues(source["auth"], engine.Auth);
	        this.variables = source["variables"];
	        this.options = this.convertValues(source["options"], engine.Options);
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
	    tool: string;
	    arguments: string;
	
	    static createFrom(source: any = {}) {
	        return new Call(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.target = this.convertValues(source["target"], Target);
	        this.tool = source["tool"];
	        this.arguments = source["arguments"];
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
	export class Tool {
	    name: string;
	    description: string;
	    inputSchema: string;
	    skeleton: string;
	
	    static createFrom(source: any = {}) {
	        return new Tool(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.description = source["description"];
	        this.inputSchema = source["inputSchema"];
	        this.skeleton = source["skeleton"];
	    }
	}
	export class Catalog {
	    server: mcp.Implementation;
	    protocolVersion: string;
	    instructions: string;
	    tools: Tool[];
	
	    static createFrom(source: any = {}) {
	        return new Catalog(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.server = this.convertValues(source["server"], mcp.Implementation);
	        this.protocolVersion = source["protocolVersion"];
	        this.instructions = source["instructions"];
	        this.tools = this.convertValues(source["tools"], Tool);
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
	
	export class Fault {
	    percent: number;
	    kind: string;
	    status: number;
	
	    static createFrom(source: any = {}) {
	        return new Fault(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.percent = source["percent"];
	        this.kind = source["kind"];
	        this.status = source["status"];
	    }
	}
	export class Behavior {
	    delayMs: number;
	    delayMaxMs: number;
	    slowBodyMs: number;
	    fault: Fault;
	
	    static createFrom(source: any = {}) {
	        return new Behavior(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.delayMs = source["delayMs"];
	        this.delayMaxMs = source["delayMaxMs"];
	        this.slowBodyMs = source["slowBodyMs"];
	        this.fault = this.convertValues(source["fault"], Fault);
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
	export class Condition {
	    field: string;
	    name: string;
	    op: string;
	    value: string;
	
	    static createFrom(source: any = {}) {
	        return new Condition(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.field = source["field"];
	        this.name = source["name"];
	        this.op = source["op"];
	        this.value = source["value"];
	    }
	}
	export class RouteOptions {
	    disabled: boolean;
	    behavior: Behavior;
	
	    static createFrom(source: any = {}) {
	        return new RouteOptions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.disabled = source["disabled"];
	        this.behavior = this.convertValues(source["behavior"], Behavior);
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
	export class Header {
	    key: string;
	    value: string;
	
	    static createFrom(source: any = {}) {
	        return new Header(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.key = source["key"];
	        this.value = source["value"];
	    }
	}
	export class Rule {
	    id: string;
	    name: string;
	    disabled: boolean;
	    method: string;
	    path: string;
	    conditions: Condition[];
	    nth: number;
	    exampleId: string;
	    status: number;
	    headers: Header[];
	    body: string;
	    behavior: Behavior;
	
	    static createFrom(source: any = {}) {
	        return new Rule(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.disabled = source["disabled"];
	        this.method = source["method"];
	        this.path = source["path"];
	        this.conditions = this.convertValues(source["conditions"], Condition);
	        this.nth = source["nth"];
	        this.exampleId = source["exampleId"];
	        this.status = source["status"];
	        this.headers = this.convertValues(source["headers"], Header);
	        this.body = source["body"];
	        this.behavior = this.convertValues(source["behavior"], Behavior);
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
	export class Source {
	    id: string;
	    name: string;
	    method: string;
	    url: string;
	    examples: string;
	    exampleId: string;
	    path: string;
	    types: Record<string, string>;
	
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
	        this.path = source["path"];
	        this.types = source["types"];
	    }
	}
	export class Spec {
	    title: string;
	    sources: Source[];
	
	    static createFrom(source: any = {}) {
	        return new Spec(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.title = source["title"];
	        this.sources = this.convertValues(source["sources"], Source);
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
	    port: number;
	    cors: boolean;
	    corsOrigins: string[];
	    behavior: Behavior;
	
	    static createFrom(source: any = {}) {
	        return new Settings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.port = source["port"];
	        this.cors = source["cors"];
	        this.corsOrigins = source["corsOrigins"];
	        this.behavior = this.convertValues(source["behavior"], Behavior);
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
	export class Config {
	    settings: Settings;
	    spec: Spec;
	    rules: Rule[];
	    routes: Record<string, RouteOptions>;
	    selections: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new Config(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.settings = this.convertValues(source["settings"], Settings);
	        this.spec = this.convertValues(source["spec"], Spec);
	        this.rules = this.convertValues(source["rules"], Rule);
	        this.routes = this.convertValues(source["routes"], RouteOptions, true);
	        this.selections = source["selections"];
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
	export class Entry {
	    id: number;
	    // Go type: time
	    time: any;
	    method: string;
	    path: string;
	    headers: Header[];
	    body: string;
	    bodyBytes: number;
	    route: string;
	    rule: string;
	    fault: string;
	    status: number;
	    durationMs: number;
	
	    static createFrom(source: any = {}) {
	        return new Entry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.time = this.convertValues(source["time"], null);
	        this.method = source["method"];
	        this.path = source["path"];
	        this.headers = this.convertValues(source["headers"], Header);
	        this.body = source["body"];
	        this.bodyBytes = source["bodyBytes"];
	        this.route = source["route"];
	        this.rule = source["rule"];
	        this.fault = source["fault"];
	        this.status = source["status"];
	        this.durationMs = source["durationMs"];
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
	
	
	
	

}

export namespace openapi {
	
	export class SchemaNode {
	    name?: string;
	    ref?: string;
	    type?: string;
	    format?: string;
	    title?: string;
	    description?: string;
	    required?: boolean;
	    nullable?: boolean;
	    readOnly?: boolean;
	    writeOnly?: boolean;
	    deprecated?: boolean;
	    enum?: string[];
	    default?: string;
	    example?: string;
	    constraints?: string;
	    properties?: SchemaNode[];
	    items?: SchemaNode;
	    additionalProperties?: SchemaNode;
	    combine?: string;
	    options?: SchemaNode[];
	    circular?: boolean;
	    truncated?: boolean;
	
	    static createFrom(source: any = {}) {
	        return new SchemaNode(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.ref = source["ref"];
	        this.type = source["type"];
	        this.format = source["format"];
	        this.title = source["title"];
	        this.description = source["description"];
	        this.required = source["required"];
	        this.nullable = source["nullable"];
	        this.readOnly = source["readOnly"];
	        this.writeOnly = source["writeOnly"];
	        this.deprecated = source["deprecated"];
	        this.enum = source["enum"];
	        this.default = source["default"];
	        this.example = source["example"];
	        this.constraints = source["constraints"];
	        this.properties = this.convertValues(source["properties"], SchemaNode);
	        this.items = this.convertValues(source["items"], SchemaNode);
	        this.additionalProperties = this.convertValues(source["additionalProperties"], SchemaNode);
	        this.combine = source["combine"];
	        this.options = this.convertValues(source["options"], SchemaNode);
	        this.circular = source["circular"];
	        this.truncated = source["truncated"];
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
	export class BodyInfo {
	    contentType: string;
	    schema?: SchemaNode;
	    example: string;
	
	    static createFrom(source: any = {}) {
	        return new BodyInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.contentType = source["contentType"];
	        this.schema = this.convertValues(source["schema"], SchemaNode);
	        this.example = source["example"];
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
	export class OperationRef {
	    key: string;
	    operationId: string;
	    hash: string;
	    tag: string;
	    deprecated: boolean;
	
	    static createFrom(source: any = {}) {
	        return new OperationRef(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.key = source["key"];
	        this.operationId = source["operationId"];
	        this.hash = source["hash"];
	        this.tag = source["tag"];
	        this.deprecated = source["deprecated"];
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
	    auth: engine.Auth;
	    examples: string;
	
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
	        this.auth = this.convertValues(source["auth"], engine.Auth);
	        this.examples = source["examples"];
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
	export class Collection {
	    title: string;
	    version: string;
	    hash: string;
	    total: number;
	    folders: Folder[];
	    requests: Request[];
	    operations: OperationRef[];
	    variables: Record<string, string>;
	    warnings: string[];
	
	    static createFrom(source: any = {}) {
	        return new Collection(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.title = source["title"];
	        this.version = source["version"];
	        this.hash = source["hash"];
	        this.total = source["total"];
	        this.folders = this.convertValues(source["folders"], Folder);
	        this.requests = this.convertValues(source["requests"], Request);
	        this.operations = this.convertValues(source["operations"], OperationRef);
	        this.variables = source["variables"];
	        this.warnings = source["warnings"];
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
	export class ResponseInfo {
	    status: string;
	    description: string;
	    bodies: BodyInfo[];
	
	    static createFrom(source: any = {}) {
	        return new ResponseInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.status = source["status"];
	        this.description = source["description"];
	        this.bodies = this.convertValues(source["bodies"], BodyInfo);
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
	export class ParameterInfo {
	    name: string;
	    in: string;
	    required: boolean;
	    description: string;
	    schema?: SchemaNode;
	    example: string;
	
	    static createFrom(source: any = {}) {
	        return new ParameterInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.in = source["in"];
	        this.required = source["required"];
	        this.description = source["description"];
	        this.schema = this.convertValues(source["schema"], SchemaNode);
	        this.example = source["example"];
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
	export class Operation {
	    key: string;
	    operationId: string;
	    method: string;
	    path: string;
	    summary: string;
	    tags: string[];
	    deprecated: boolean;
	    hash: string;
	
	    static createFrom(source: any = {}) {
	        return new Operation(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.key = source["key"];
	        this.operationId = source["operationId"];
	        this.method = source["method"];
	        this.path = source["path"];
	        this.summary = source["summary"];
	        this.tags = source["tags"];
	        this.deprecated = source["deprecated"];
	        this.hash = source["hash"];
	    }
	}
	export class Detail {
	    operation: Operation;
	    description: string;
	    parameters: ParameterInfo[];
	    bodyRequired: boolean;
	    bodies: BodyInfo[];
	    responses: ResponseInfo[];
	    security: string[];
	    request?: Request;
	
	    static createFrom(source: any = {}) {
	        return new Detail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.operation = this.convertValues(source["operation"], Operation);
	        this.description = source["description"];
	        this.parameters = this.convertValues(source["parameters"], ParameterInfo);
	        this.bodyRequired = source["bodyRequired"];
	        this.bodies = this.convertValues(source["bodies"], BodyInfo);
	        this.responses = this.convertValues(source["responses"], ResponseInfo);
	        this.security = source["security"];
	        this.request = this.convertValues(source["request"], Request);
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
	
	export class Info {
	    title: string;
	    description: string;
	    version: string;
	
	    static createFrom(source: any = {}) {
	        return new Info(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.title = source["title"];
	        this.description = source["description"];
	        this.version = source["version"];
	    }
	}
	
	
	
	export class Source {
	    text: string;
	    url: string;
	    path: string;
	
	    static createFrom(source: any = {}) {
	        return new Source(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.text = source["text"];
	        this.url = source["url"];
	        this.path = source["path"];
	    }
	}
	export class Query {
	    action: string;
	    source: Source;
	    offset: number;
	    limit: number;
	    keys: string[];
	    key: string;
	    name: string;
	
	    static createFrom(source: any = {}) {
	        return new Query(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.action = source["action"];
	        this.source = this.convertValues(source["source"], Source);
	        this.offset = source["offset"];
	        this.limit = source["limit"];
	        this.keys = source["keys"];
	        this.key = source["key"];
	        this.name = source["name"];
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
	export class Tag {
	    name: string;
	    description: string;
	
	    static createFrom(source: any = {}) {
	        return new Tag(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.description = source["description"];
	    }
	}
	export class Server {
	    url: string;
	    description: string;
	
	    static createFrom(source: any = {}) {
	        return new Server(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.url = source["url"];
	        this.description = source["description"];
	    }
	}
	export class Summary {
	    info: Info;
	    version: string;
	    hash: string;
	    servers: Server[];
	    tags: Tag[];
	    operations: Operation[];
	    schemas: string[];
	    security: string[];
	    variables: Record<string, string>;
	    warnings: string[];
	
	    static createFrom(source: any = {}) {
	        return new Summary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.info = this.convertValues(source["info"], Info);
	        this.version = source["version"];
	        this.hash = source["hash"];
	        this.servers = this.convertValues(source["servers"], Server);
	        this.tags = this.convertValues(source["tags"], Tag);
	        this.operations = this.convertValues(source["operations"], Operation);
	        this.schemas = source["schemas"];
	        this.security = source["security"];
	        this.variables = source["variables"];
	        this.warnings = source["warnings"];
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
	export class Reply {
	    error?: string;
	    summary?: Summary;
	    collection?: Collection;
	    detail?: Detail;
	    schema?: SchemaNode;
	
	    static createFrom(source: any = {}) {
	        return new Reply(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.error = source["error"];
	        this.summary = this.convertValues(source["summary"], Summary);
	        this.collection = this.convertValues(source["collection"], Collection);
	        this.detail = this.convertValues(source["detail"], Detail);
	        this.schema = this.convertValues(source["schema"], SchemaNode);
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
	    inherited?: engine.Layer[];
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
	        this.inherited = this.convertValues(source["inherited"], engine.Layer);
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

export namespace scan {
	
	export class Options {
	    skipExamples: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Options(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.skipExamples = source["skipExamples"];
	    }
	}
	export class Query {
	    collection?: workspace.Collection;
	    options: Options;
	
	    static createFrom(source: any = {}) {
	        return new Query(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.collection = this.convertValues(source["collection"], workspace.Collection);
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
	export class Location {
	    kind: string;
	    path: string;
	    field: string;
	    requestId?: string;
	
	    static createFrom(source: any = {}) {
	        return new Location(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.kind = source["kind"];
	        this.path = source["path"];
	        this.field = source["field"];
	        this.requestId = source["requestId"];
	    }
	}
	export class Finding {
	    // Go type: Location
	    location: any;
	    rule: string;
	    severity: string;
	    preview: string;
	    reason: string;
	    fingerprint: string;
	
	    static createFrom(source: any = {}) {
	        return new Finding(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.location = this.convertValues(source["location"], null);
	        this.rule = source["rule"];
	        this.severity = source["severity"];
	        this.preview = source["preview"];
	        this.reason = source["reason"];
	        this.fingerprint = source["fingerprint"];
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
	export class Counts {
	    requests: number;
	    folders: number;
	    environments: number;
	
	    static createFrom(source: any = {}) {
	        return new Counts(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.requests = source["requests"];
	        this.folders = source["folders"];
	        this.environments = source["environments"];
	    }
	}
	export class Reply {
	    error?: string;
	    // Go type: Counts
	    scanned: any;
	    findings: Finding[];
	
	    static createFrom(source: any = {}) {
	        return new Reply(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.error = source["error"];
	        this.scanned = this.convertValues(source["scanned"], null);
	        this.findings = this.convertValues(source["findings"], Finding);
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

export namespace secrets {
	
	export class Field {
	    name: string;
	    secret: boolean;
	    required: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Field(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.secret = source["secret"];
	        this.required = source["required"];
	    }
	}
	export class KindInfo {
	    name: string;
	    fields: Field[];
	
	    static createFrom(source: any = {}) {
	        return new KindInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.fields = this.convertValues(source["fields"], Field);
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
	export class Ref {
	    provider: string;
	    path: string;
	    field?: string;
	    version?: string;
	
	    static createFrom(source: any = {}) {
	        return new Ref(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.provider = source["provider"];
	        this.path = source["path"];
	        this.field = source["field"];
	        this.version = source["version"];
	    }
	}

}

export namespace workspace {
	
	export class Settings {
	    description: string;
	    headers: string;
	    auth: engine.Auth;
	    preScript: string;
	    postScript: string;
	    assertions: string;
	
	    static createFrom(source: any = {}) {
	        return new Settings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.description = source["description"];
	        this.headers = source["headers"];
	        this.auth = this.convertValues(source["auth"], engine.Auth);
	        this.preScript = source["preScript"];
	        this.postScript = source["postScript"];
	        this.assertions = source["assertions"];
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
	export class Environment {
	    id: string;
	    name: string;
	    variables: string;
	    color: string;
	    extends: string;
	    meta: string;
	
	    static createFrom(source: any = {}) {
	        return new Environment(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.variables = source["variables"];
	        this.color = source["color"];
	        this.extends = source["extends"];
	        this.meta = source["meta"];
	    }
	}
	export class Folder {
	    id: string;
	    name: string;
	    parentId: string;
	    sortOrder: number;
	    variables: string;
	    description: string;
	    headers: string;
	    auth: engine.Auth;
	    preScript: string;
	    postScript: string;
	    assertions: string;
	
	    static createFrom(source: any = {}) {
	        return new Folder(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.parentId = source["parentId"];
	        this.sortOrder = source["sortOrder"];
	        this.variables = source["variables"];
	        this.description = source["description"];
	        this.headers = source["headers"];
	        this.auth = this.convertValues(source["auth"], engine.Auth);
	        this.preScript = source["preScript"];
	        this.postScript = source["postScript"];
	        this.assertions = source["assertions"];
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
	    mcpTool: string;
	    mcpArguments: string;
	    vars: string;
	    timestamp: string;
	    sortOrder: number;
	
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
	        this.mcpTool = source["mcpTool"];
	        this.mcpArguments = source["mcpArguments"];
	        this.vars = source["vars"];
	        this.timestamp = source["timestamp"];
	        this.sortOrder = source["sortOrder"];
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
	export class Collection {
	    requests: Request[];
	    folders: Folder[];
	    environments: Environment[];
	    variables?: string;
	    settings: Settings;
	
	    static createFrom(source: any = {}) {
	        return new Collection(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.requests = this.convertValues(source["requests"], Request);
	        this.folders = this.convertValues(source["folders"], Folder);
	        this.environments = this.convertValues(source["environments"], Environment);
	        this.variables = source["variables"];
	        this.settings = this.convertValues(source["settings"], Settings);
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

