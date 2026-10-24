package engine

import "slices"

type country struct {
	name string
	code string
}

type currency struct {
	code   string
	name   string
	symbol string
}

type ibanLayout struct {
	country string
	letters int
	digits  int
}

type mediaType struct {
	mime      string
	extension string
}

var (
	firstNames   = []string{"Ada", "Alan", "Grace", "Linus", "Margaret", "Dennis", "Barbara", "Ken", "Radia", "Edsger", "Hedy", "Tim"}
	lastNames    = []string{"Lovelace", "Turing", "Hopper", "Torvalds", "Hamilton", "Ritchie", "Liskov", "Thompson", "Perlman", "Dijkstra", "Lamarr", "Berners"}
	words        = []string{"amber", "breeze", "cobalt", "dune", "ember", "fjord", "glacier", "harbor", "indigo", "juniper", "kelp", "lagoon", "meadow", "nectar", "orchid", "prairie"}
	mailHosts    = []string{"example.com", "example.org", "example.net"}
	namePrefixes = []string{"Mr.", "Mrs.", "Ms.", "Miss", "Dr."}
	nameSuffixes = []string{"Jr.", "Sr.", "I", "II", "III", "IV", "V", "MD", "DDS", "PhD", "DVM"}

	jobDescriptors = []string{"Lead", "Senior", "Direct", "Corporate", "Dynamic", "Future", "Product", "National", "Regional", "District", "Central", "Global", "Customer", "Investor", "Internal", "International", "Chief", "Principal"}
	jobAreas       = []string{"Solutions", "Program", "Brand", "Security", "Research", "Marketing", "Directives", "Implementation", "Integration", "Functionality", "Response", "Paradigm", "Tactics", "Identity", "Markets", "Group", "Division", "Applications", "Optimization", "Operations", "Infrastructure", "Intranet", "Communications", "Web", "Branding", "Quality", "Assurance", "Mobility", "Accounts", "Data", "Creative", "Configuration", "Accountability", "Interactions", "Factors", "Usability", "Metrics"}
	jobTypes       = []string{"Supervisor", "Associate", "Executive", "Liaison", "Officer", "Manager", "Engineer", "Specialist", "Director", "Coordinator", "Administrator", "Architect", "Analyst", "Designer", "Planner", "Orchestrator", "Technician", "Developer", "Producer", "Consultant", "Assistant", "Facilitator", "Agent", "Representative", "Strategist"}

	citySuffixes   = []string{"port", "ton", "ville", "burgh", "field", "haven", "mouth", "side", "land", "stad", "berg", "view", "ford", "chester"}
	streetSuffixes = []string{"Street", "Avenue", "Road", "Lane", "Drive", "Court", "Place", "Way", "Boulevard", "Terrace", "Square", "Crescent", "Orchard", "Springs"}
	states         = []string{"Alabama", "Alaska", "Arizona", "California", "Colorado", "Florida", "Georgia", "Hawaii", "Illinois", "Maine", "Michigan", "Nevada", "New York", "Ohio", "Oregon", "Texas", "Utah", "Vermont", "Virginia", "Washington"}
	timeZones      = []string{"UTC", "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Madrid", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Sao_Paulo", "Asia/Tokyo", "Asia/Kolkata", "Asia/Shanghai", "Asia/Singapore", "Australia/Sydney", "Africa/Johannesburg"}
	countries      = []country{
		{"Argentina", "AR"}, {"Australia", "AU"}, {"Austria", "AT"}, {"Belgium", "BE"}, {"Brazil", "BR"}, {"Canada", "CA"},
		{"Chile", "CL"}, {"Denmark", "DK"}, {"Egypt", "EG"}, {"Finland", "FI"}, {"France", "FR"}, {"Germany", "DE"},
		{"Greece", "GR"}, {"India", "IN"}, {"Ireland", "IE"}, {"Italy", "IT"}, {"Japan", "JP"}, {"Kenya", "KE"},
		{"Mexico", "MX"}, {"Netherlands", "NL"}, {"New Zealand", "NZ"}, {"Nigeria", "NG"}, {"Norway", "NO"}, {"Poland", "PL"},
		{"Portugal", "PT"}, {"Singapore", "SG"}, {"South Africa", "ZA"}, {"South Korea", "KR"}, {"Spain", "ES"}, {"Sweden", "SE"},
		{"Switzerland", "CH"}, {"Turkey", "TR"}, {"United Kingdom", "GB"}, {"United States", "US"}, {"Vietnam", "VN"},
	}
	locales = []string{"en", "fr", "de", "es", "it", "pt", "nl", "sv", "da", "fi", "no", "pl", "cs", "ru", "uk", "tr", "ar", "he", "hi", "ja", "ko", "zh"}

	currencies = []currency{
		{"USD", "US Dollar", "$"}, {"EUR", "Euro", "€"}, {"GBP", "Pound Sterling", "£"}, {"JPY", "Yen", "¥"},
		{"INR", "Indian Rupee", "₹"}, {"CHF", "Swiss Franc", "CHF"}, {"CAD", "Canadian Dollar", "$"}, {"AUD", "Australian Dollar", "$"},
		{"CNY", "Yuan Renminbi", "¥"}, {"SEK", "Swedish Krona", "kr"}, {"BRL", "Brazilian Real", "R$"}, {"KRW", "Won", "₩"},
	}
	ibanLayouts      = []ibanLayout{{"DE", 0, 18}, {"GB", 4, 14}, {"NL", 4, 10}, {"ES", 0, 20}, {"FR", 0, 23}}
	transactionTypes = []string{"deposit", "withdrawal", "payment", "invoice"}
	bankAccountNames = []string{"Checking Account", "Savings Account", "Money Market Account", "Investment Account", "Credit Card Account", "Personal Loan Account", "Home Loan Account", "Auto Loan Account"}

	companySuffixes        = []string{"Inc", "and Sons", "LLC", "Group"}
	bsAdjectives           = []string{"clicks-and-mortar", "value-added", "vertical", "proactive", "robust", "revolutionary", "scalable", "leading-edge", "innovative", "intuitive", "strategic", "e-business", "mission-critical", "sticky", "seamless", "viral", "killer", "real-time"}
	bsBuzzwords            = []string{"implement", "utilize", "integrate", "streamline", "optimize", "evolve", "transform", "embrace", "enable", "orchestrate", "leverage", "reinvent", "aggregate", "architect", "enhance", "incentivize", "harness", "deploy"}
	bsNouns                = []string{"synergies", "web-readiness", "paradigms", "markets", "partnerships", "infrastructures", "platforms", "initiatives", "channels", "eyeballs", "communities", "solutions", "action-items", "portals", "niches", "technologies", "schemas", "networks"}
	catchPhraseAdjectives  = []string{"Adaptive", "Advanced", "Automated", "Balanced", "Business-focused", "Centralized", "Configurable", "Cross-platform", "Customer-focused", "Decentralized", "Digitized", "Distributed", "Ergonomic", "Exclusive", "Expanded", "Fundamental", "Future-proofed", "Horizontal", "Innovative", "Integrated", "Intuitive", "Managed", "Multi-layered", "Open-architected", "Optimized", "Persistent", "Proactive", "Re-engineered", "Reduced", "Secured", "Streamlined", "Synchronized", "Total", "Universal", "User-friendly", "Versatile", "Virtual", "Visionary"}
	catchPhraseDescriptors = []string{"24 hour", "24/7", "3rd generation", "actuating", "analyzing", "asymmetric", "bi-directional", "client-driven", "client-server", "coherent", "contextually-based", "dedicated", "demand-driven", "didactic", "discrete", "dynamic", "executive", "explicit", "fault-tolerant", "global", "heuristic", "hybrid", "interactive", "local", "logistical", "mission-critical", "modular", "multimedia", "needs-based", "next generation", "real-time", "regional", "scalable", "stable", "systematic", "transitional", "zero tolerance"}
	catchPhraseNouns       = []string{"ability", "access", "adapter", "algorithm", "alliance", "analyzer", "application", "approach", "architecture", "archive", "array", "attitude", "benchmark", "capability", "circuit", "collaboration", "complexity", "concept", "core", "database", "definition", "emulation", "encoding", "encryption", "firmware", "flexibility", "framework", "function", "groupware", "hierarchy", "hub", "infrastructure", "interface", "knowledge base", "methodology", "middleware", "model", "moderator", "monitoring", "neural-net", "paradigm", "policy", "portal", "process improvement", "productivity", "project", "protocol", "service-desk", "software", "solution", "standardization", "strategy", "superstructure", "support", "synergy", "throughput", "toolset", "website", "workforce"}
	databaseColumns        = []string{"id", "title", "name", "email", "password", "token", "group", "category", "status", "comment", "avatar", "createdAt", "updatedAt"}
	databaseTypes          = []string{"int", "varchar", "text", "date", "datetime", "tinyint", "time", "timestamp", "smallint", "mediumint", "bigint", "decimal", "float", "double", "real", "bit", "boolean", "serial", "blob", "binary", "enum", "set", "geometry", "point"}
	databaseCollations     = []string{"utf8_unicode_ci", "utf8_general_ci", "utf8_bin", "ascii_bin", "ascii_general_ci", "cp1250_bin", "cp1250_general_ci", "utf8mb4_unicode_ci"}
	databaseEngines        = []string{"InnoDB", "MyISAM", "MEMORY", "CSV", "BLACKHOLE", "ARCHIVE"}
	mailProviders          = []string{"gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "proton.me"}
	domainSuffixes         = []string{"com", "net", "org", "info", "biz", "io", "dev", "name"}
	internetProtocols      = []string{"http", "https"}
	colorNames             = []string{"red", "green", "blue", "yellow", "orange", "purple", "pink", "black", "white", "gray", "teal", "cyan", "magenta", "lime", "maroon", "navy", "olive", "silver", "fuchsia", "indigo", "violet", "turquoise", "salmon", "gold"}
	hackerAbbreviations    = []string{"ADP", "AGP", "AI", "API", "CSS", "EXE", "FTP", "GB", "HDD", "HTTP", "IP", "JSON", "PCI", "PNG", "RAM", "RSS", "SAS", "SCSI", "SDD", "SMS", "SMTP", "SQL", "SSD", "SSL", "TCP", "USB", "XML", "XSS"}
	hackerAdjectives       = []string{"auxiliary", "primary", "back-end", "digital", "open-source", "virtual", "cross-platform", "redundant", "online", "haptic", "multi-byte", "bluetooth", "wireless", "1080p", "neural", "optical", "solid state", "mobile"}
	hackerNouns            = []string{"driver", "protocol", "bandwidth", "panel", "microchip", "program", "port", "card", "array", "interface", "system", "sensor", "firewall", "hard drive", "pixel", "alarm", "feed", "monitor", "application", "transmitter", "bus", "circuit", "capacitor", "matrix"}
	hackerVerbs            = []string{"back up", "bypass", "hack", "override", "compress", "copy", "navigate", "index", "connect", "generate", "quantify", "calculate", "synthesize", "input", "transmit", "program", "reboot", "parse"}
	hackerIngverbs         = []string{"backing up", "bypassing", "hacking", "overriding", "compressing", "copying", "navigating", "indexing", "connecting", "generating", "quantifying", "calculating", "synthesizing", "transmitting", "programming", "parsing"}
	products               = []string{"Chair", "Car", "Computer", "Keyboard", "Mouse", "Bike", "Ball", "Gloves", "Pants", "Shirt", "Table", "Shoes", "Hat", "Towels", "Soap", "Tuna", "Chicken", "Fish", "Cheese", "Bacon", "Pizza", "Salad", "Sausages", "Chips"}
	productAdjectives      = []string{"Small", "Ergonomic", "Rustic", "Intelligent", "Gorgeous", "Incredible", "Fantastic", "Practical", "Sleek", "Awesome", "Generic", "Handcrafted", "Handmade", "Licensed", "Refined", "Unbranded", "Tasty"}
	productMaterials       = []string{"Steel", "Wooden", "Concrete", "Plastic", "Cotton", "Granite", "Rubber", "Metal", "Soft", "Fresh", "Frozen", "Bronze", "Marble"}
	departments            = []string{"Books", "Movies", "Music", "Games", "Electronics", "Computers", "Home", "Garden", "Tools", "Grocery", "Health", "Beauty", "Toys", "Kids", "Baby", "Clothing", "Shoes", "Jewelery", "Sports", "Outdoors", "Automotive", "Industrial"}
	directoryPaths         = []string{"/usr/local/bin", "/usr/share", "/etc", "/var/log", "/var/lib", "/opt", "/srv/data", "/tmp", "/home/user", "/home/user/documents"}
	imageCategories        = []string{"abstract", "animals", "business", "cats", "city", "food", "nightlife", "fashion", "people", "nature", "sports", "transport"}
	loremWords             = []string{"lorem", "ipsum", "dolor", "sit", "amet", "consectetur", "adipiscing", "elit", "sed", "do", "eiusmod", "tempor", "incididunt", "ut", "labore", "et", "dolore", "magna", "aliqua", "enim", "ad", "minim", "veniam", "quis", "nostrud", "exercitation", "ullamco", "laboris", "nisi", "aliquip", "ex", "ea", "commodo", "consequat", "duis", "aute", "irure", "in", "reprehenderit", "voluptate", "velit", "esse", "cillum", "fugiat", "nulla", "pariatur", "excepteur", "sint", "occaecat", "cupidatat", "non", "proident", "sunt", "culpa", "qui", "officia", "deserunt", "mollit", "anim", "id", "est", "laborum"}
	userAgents             = []string{
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
		"Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15",
		"Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0",
		"Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1",
		"Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36",
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0",
	}
	commonMediaTypes = []mediaType{
		{"application/pdf", "pdf"}, {"application/json", "json"}, {"application/zip", "zip"}, {"application/xml", "xml"},
		{"image/png", "png"}, {"image/jpeg", "jpg"}, {"image/gif", "gif"}, {"image/svg+xml", "svg"}, {"image/webp", "webp"},
		{"text/plain", "txt"}, {"text/csv", "csv"}, {"text/html", "html"}, {"audio/mpeg", "mp3"}, {"audio/wav", "wav"},
		{"video/mp4", "mp4"}, {"video/webm", "webm"},
	}
	rareMediaTypes = []mediaType{
		{"application/vnd.ms-excel", "xls"}, {"application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"},
		{"application/x-7z-compressed", "7z"}, {"application/x-tar", "tar"}, {"application/epub+zip", "epub"},
		{"application/x-cpio", "cpio"}, {"audio/vnd.dts", "dts"}, {"audio/ogg", "oga"}, {"video/x-matroska", "mkv"},
		{"image/tiff", "tiff"}, {"font/woff2", "woff2"}, {"model/gltf+json", "gltf"}, {"text/calendar", "ics"},
	}
)

var allMediaTypes = slices.Concat(commonMediaTypes, rareMediaTypes)
