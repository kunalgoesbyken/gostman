export const HTTP_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "GRAPHQL"]

// Methods are coloured by what they do, not by which method they are: reads are
// safe, writes warn, DELETE is destructive, and GraphQL takes the brand accent.
// Classes are spelled out because Tailwind only generates what it finds in source.
export const METHOD_COLORS = {
    GET: "text-success",
    HEAD: "text-success",
    POST: "text-warning",
    PUT: "text-warning",
    PATCH: "text-warning",
    DELETE: "text-destructive",
    GRAPHQL: "text-primary",
}

export const METHOD_CHIPS = {
    GET: "text-success bg-success/10",
    HEAD: "text-success bg-success/10",
    POST: "text-warning bg-warning/10",
    PUT: "text-warning bg-warning/10",
    PATCH: "text-warning bg-warning/10",
    DELETE: "text-destructive bg-destructive/10",
    GRAPHQL: "text-primary bg-primary/10",
}

export const METHOD_VARIANTS = {
    GET: "get",
    POST: "post",
    PUT: "put",
    DELETE: "delete",
    PATCH: "patch",
    HEAD: "head",
    GRAPHQL: "graphql",
}
