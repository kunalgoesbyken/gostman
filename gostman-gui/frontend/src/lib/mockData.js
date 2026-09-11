export const DEFAULT_REQUEST = {
    id: "",
    name: "New Request",
    method: "GET",
    url: "",
    headers: "{}",
    body: "",
    queryParams: "{}",
    graphqlQuery: "",
    graphqlVariables: "{}",
    response: "",
    responseHeaders: {},
    responseType: "text" // text, image, html
}

export const mockRequests = [
    {
        id: "1",
        name: "Example GET Request",
        method: "GET",
        url: "https://api.example.com/users",
        headers: '{"Content-Type": "application/json"}',
        body: "",
        queryParams: '{}',
        response: '{"status": "success", "data": []}',
        folderId: null
    }
]

export const mockFolders = [
    { id: "f1", name: "User API", isOpen: true }
]
