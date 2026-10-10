async function fetchStars(token) {
    const headers = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "Gostman-Landing-Page"
    };

    if (token) {
        headers["Authorization"] = `token ${token}`;
    }

    const res = await fetch("https://api.github.com/repos/kunalgoesbyken/gostman", { headers });

    if (res.status === 401 && token) {
        console.warn("GITHUB_TOKEN rejected, falling back to unauthenticated request");
        return fetchStars(null);
    }

    if (!res.ok) {
        throw new Error(`GitHub API responded with ${res.status}`);
    }

    return res.json();
}

export default async function handler(request, response) {
    const token = process.env.GITHUB_TOKEN;

    try {
        const data = await fetchStars(token);

        response.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
        return response.status(200).json({ stars: data.stargazers_count });
    } catch (error) {
        console.error("Error fetching stars:", error);
        return response.status(500).json({ error: "Failed to fetch stars" });
    }
}
