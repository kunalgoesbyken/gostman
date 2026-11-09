# Self-hosting the web app

You can run the Gostman web app on your own server, so your team opens it at an address you control and its requests leave from your network. The server stores nothing. Requests, collections and environments stay in each person's browser, in its IndexedDB, as on gostman.com (see [Where your data is kept](getting-started.md#where-your-data-is-kept)). The server serves the app and relays requests: browsers cannot call most APIs directly, so the web app sends each request to `/api/proxy` on its own address, and that endpoint sends it on and returns the answer. WebSocket connections and AI providers are still called straight from the browser.

## Choose a way to host it

| Option | What you need | Fits | Reaches private and internal APIs | Response limit |
| --- | --- | --- | --- | --- |
| [Docker image](#docker-image) | A host that runs containers; a prebuilt image is published | A team that already runs containers | Only with `--allow-private` | 3 MB |
| [`gostman serve`](#gostman-serve) | Go and Node.js to build, a server to run it on | One binary on a plain server, no Docker | Only with `--allow-private` | 3 MB |
| [Your own Vercel project](#your-own-vercel-project) | A GitHub fork and a Vercel account | Managed hosting with no servers to run | No | 3 MB |
| [`gostman relay`](#gostman-relay-with-gostmancom) | The command line, on each computer | One person, no server at all | Yes, from that computer | 50 MB |

- Internal APIs behind a VPN: use the [Docker image](#docker-image) with `--allow-private`, behind your own authentication.
- One binary and no Docker: use [`gostman serve`](#gostman-serve).
- Managed hosting with no operations work: use [your own Vercel project](#your-own-vercel-project).
- No server at all, requests from your own computer: use [`gostman relay`](#gostman-relay-with-gostmancom) with the hosted web app.

## What the server needs

The server only hands out the built web app and passes requests on; collections, environments and history stay in each browser, so the server keeps no data and needs no database.

| | Measured | Plan for |
| --- | --- | --- |
| Memory, idle | About 20 MB | |
| Memory, 50 requests at once, each with a 3 MB response | About 90 MB at the peak | 256 MB for a team, 128 MB for a few people |
| Processor | Barely used; requests mostly wait on the APIs they call | Any single core, including a Raspberry Pi with a 64-bit system |
| Disk | 26 MB to download the image, 25 MB for the built web app | 100 MB |

Memory grows with the number of requests in flight, not with the number of people who have the page open, and each response is capped at 3 MB. The image runs on `linux/amd64` and `linux/arm64`. Building the web app yourself needs Node.js and more memory than running it; the prebuilt image skips that step.

## Docker image

**Requirements.** Docker, and a host that can run a container. Node.js and Go are not needed on the host.

**Steps.** Each release publishes `ghcr.io/kunalgoesbyken/gostman-web` for `linux/amd64` and `linux/arm64`, tagged with the version and `latest`. It is not the image of the command line, `ghcr.io/kunalgoesbyken/gostman` (see [Docker and CI](cli.md#docker-and-ci)).

```bash
docker run -p 8080:8080 ghcr.io/kunalgoesbyken/gostman-web
```

Open `http://localhost:8080`. The container listens on port 8080 on every interface and runs as a non-root user. When a reverse proxy on the same host fronts it, publish the port to that host only with `-p 127.0.0.1:8080:8080`. To let the proxy reach private addresses, add the flag after the image name (read [Reach internal APIs](#reach-internal-apis) first):

```bash
docker run -p 8080:8080 ghcr.io/kunalgoesbyken/gostman-web --allow-private
```

On a domain name, pass it with `--host`, as with [`gostman serve`](#gostman-serve):

```bash
docker run -p 8080:8080 ghcr.io/kunalgoesbyken/gostman-web --host api-client.example.com
```

For anything other than your own computer, put it behind HTTPS, see [Put it behind HTTPS](#put-it-behind-https).

The prebuilt image was built with the default `SITE_URL`, so its canonical, Open Graph, sitemap and `robots.txt` addresses, and the links the app shows to itself, point at gostman.com. That does not matter for private or internal use. For a public instance on your own domain, build the image yourself with `Dockerfile.web` (see [Set the public address](#set-the-public-address)), from a clone:

```bash
docker build -f Dockerfile.web --build-arg SITE_URL=https://api-client.example.com -t gostman-web .
docker run -p 8080:8080 gostman-web
```

or straight from Git:

```bash
docker build -f Dockerfile.web --build-arg SITE_URL=https://api-client.example.com -t gostman-web https://github.com/kunalgoesbyken/gostman.git
```

**Updating.** For the prebuilt image, pull it and start a new container:

```bash
docker pull ghcr.io/kunalgoesbyken/gostman-web
docker stop <container> && docker run -d -p 8080:8080 ghcr.io/kunalgoesbyken/gostman-web
```

For an image you built, run the `docker build` command again from the latest source, then start a new container from it.

## gostman serve

**Requirements.** Go, Node.js 20 or later and a checkout of the repository to build it, and a server to run the result on.

**Steps.** `gostman serve` serves a built copy of the web app and the proxy from one process:

```bash
cd gostman-gui/frontend
npm ci
SITE_URL=https://api-client.example.com npm run build:web
cd ../..
go build -o gostman ./cmd/gostman
./gostman serve --dir gostman-gui/frontend/dist-web --addr 0.0.0.0:8080
```

- `--dir path` is the folder `npm run build:web` wrote, `gostman-gui/frontend/dist-web`.
- `--addr host:port` is where it listens. The default is `127.0.0.1:8080`, which only this computer can reach. Use `0.0.0.0:8080` to accept connections from other machines, and put it behind a reverse proxy with TLS, see [Put it behind HTTPS](#put-it-behind-https).
- `--host name` is a name people reach the server by, such as `api-client.example.com`; repeat it for each name. `localhost` and IP addresses always work. A request for any other name is refused with 421, which stops a website from pointing its own domain at your server (DNS rebinding) to use its proxy.
- `--allow-private` lets the proxy reach private network addresses, see [Reach internal APIs](#reach-internal-apis).

It prints a warning when `--allow-private` is on. It sends the same headers as gostman.com, including the Content-Security-Policy that stops scripts in the sandbox worker from using the network, so a script in a request cannot send data anywhere.

**Updating.** Pull the repository, run `npm ci` and `npm run build:web` again, rebuild `gostman` and restart it.

## Your own Vercel project

**Requirements.** A GitHub fork of the repository and a Vercel account.

**Steps.** Import the fork as a project in Vercel. `vercel.json` already sets the build command, the output folder, the Go function for `/api/proxy` with a 60 second limit and the response headers, so the defaults need no changes. Add an environment variable `SITE_URL` with your address, such as `https://api-client.example.com`, before the first deployment, and add the domain under **Domains**. The variable is read during the build, so redeploy after changing it.

Vercel runs the proxy outside your network, so this option cannot reach private addresses and always has the hosted limits.

**Updating.** Sync the fork with the upstream repository. Every push to the fork's default branch deploys.

## gostman relay with gostman.com

**Requirements.** The `gostman` command line on the computer that sends the requests, see [Command line](cli.md).

**Steps.** Run `gostman relay --port 4030`, then in the hosted web app open **Preferences**, **Privacy**, choose **Local relay on this computer**, enter the address it prints and press **Test**. Requests then leave from your computer, reach `localhost` and private addresses, and are read up to 50 MB. Nothing is hosted for others: each person runs their own. See [Local relay for the web app](cli.md#local-relay-for-the-web-app).

**Updating.** Install the newer `gostman` and start the relay again.

## Set the public address

`SITE_URL` is the address people will use, such as `https://api-client.example.com`. It is read when the web app is built, not when the server starts, so changing it means building again (a build argument for the Docker image, an environment variable for `npm run build:web` and for Vercel). It fills the canonical and Open Graph addresses, `sitemap.xml`, `robots.txt`, the OAuth client metadata and the links the app shows to itself. The default, also in `Dockerfile.web` and the prebuilt image, is `https://gostman.com`. A trailing slash is ignored.

Requests do not depend on it: the web app calls `/api/proxy` on whatever address it was opened from. A copy built without `SITE_URL` works, but search engines and link previews then point to gostman.com.

## Put it behind HTTPS

Serve the app over HTTPS. Browsers limit the service worker that gives the web app its offline cache, and the encryption behind share links, to HTTPS pages and `localhost`. A reverse proxy such as Caddy gets and renews the certificate:

```text
api-client.example.com {
	reverse_proxy 127.0.0.1:8080
}
```

Start the server with `--host` and the public name, or every request through the reverse proxy is refused with 421.

The proxy refuses a request whose `Origin` header names a different host than the one it was reached through, with a 403 and the message `cross-site requests are not allowed`. It takes that host from `X-Forwarded-Host` when present, and from `Host` otherwise. Your reverse proxy must therefore pass the host name people typed, with its port if it is not the default, unchanged: Caddy does by default, and in nginx set `proxy_set_header Host $http_host;`. A proxy that rewrites `Host` can set `X-Forwarded-Host` to the original value instead.

A reverse proxy must not buffer responses or time out early, because the proxy streams Server-Sent Events and long responses. Stream requests end after 60 seconds and other requests after 30.

## Reach internal APIs

By default the server follows the hosted rules: it refuses `localhost`, loopback and private network addresses, cuts responses at 3 MB and limits a request to 30 seconds, as gostman.com does. A request to a private address answers with a message saying so.

`--allow-private` removes the address rule, so the web app can call APIs on your intranet and on the machine that runs the server.

> [!WARNING]
> With `--allow-private`, anyone who can open the page can use your server to send requests into your internal network, including to services that only trust local addresses, such as cloud metadata endpoints. Use it only when the server is behind authentication, a VPN or a firewall that limits who can reach it. Gostman has no sign-in of its own.

Without `--allow-private`, internal APIs stay reachable through the [desktop app](getting-started.md#install-the-desktop-app), the command line, or `gostman relay` on each person's computer.

## What differs from gostman.com

- The star count on the home page is the one read when you built the app, and the browser refreshes it from GitHub. There is no `/api/stars` on a server of your own.
- The visit counter on the home page is Vercel Web Analytics. It loads from `/_vercel/insights/script.js`, which only Vercel serves for a project that turned analytics on, so a server of your own counts nothing.
- OAuth 2.0 sign-in with the authorization code grant uses `/oauth-callback` on your address as the callback URL. Register `https://api-client.example.com/oauth-callback` with your provider.
- The limits are those of the hosted web app: 3 MB of a response, 30 seconds per request, and files of up to 3 MB attached to a request (see [Limits of the web version](getting-started.md#limits-of-the-web-version)). The proxy, certificate and client certificate settings stay desktop only.

## Where the data lives

On each person's browser, never on the server, so there is nothing on the server to back up or migrate, and an update does not touch it. The browser keeps data for each address apart: someone who opens the app at a new address starts empty, and clearing the site data for your address deletes their collections. Move data between addresses with an export or a backup, see [Backups](preferences-and-shortcuts.md#backups).
