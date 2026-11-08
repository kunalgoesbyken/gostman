# Fault-test your API with seedfall

The checks in a collection say what an API promises: a write that answered 200 can be read back, a deleted key stays deleted. [seedfall](https://github.com/kunalgoesbyken/seedfall) is a deterministic simulation tester for Go services. It runs your service on a simulated disk and network, crashes it in the middle of writes, tears those writes and partitions the network, and replays any failure exactly from one number, the seed. Gostman's Go `runner` package builds for the same target, so a small seedfall workload can send your collection between the faults and fail the seed when a check breaks.

This page walks through [`examples/gostman`](https://github.com/kunalgoesbyken/seedfall/tree/main/examples/gostman) in the seedfall repository: a key-value service written with plain `net/http`, and a collection that checks it.

> [!NOTE]
> seedfall runs services written in Go that build for `GOOS=wasip1`. The collection side is an ordinary Gostman folder workspace.

## 1. The collection

The workspace has two folders and two environments:

```text
collection/
  gostman.yaml
  environments/Local.yaml       base_url: http://127.0.0.1:8080
  environments/Simulation.yaml  base_url: http://server:8080
  Write/Put value.yaml          PUT {{base_url}}/kv/{{key}}, body {{value}}
  Verify/Health.yaml            GET {{base_url}}/health, no checks
  Verify/Get value.yaml         GET {{base_url}}/kv/{{key}}
  Verify/Get deleted key.yaml   GET {{base_url}}/kv/{{deleted_key}}
  Verify/Delete value.yaml      DELETE {{base_url}}/kv/{{key}}
```

The checks are ordinary assertions:

```yaml
id: req-get-value
name: Get value
description: An acknowledged write must still be there.
order: 2
method: GET
url: "{{base_url}}/kv/{{key}}"
assertions:
  - expression: res.status
    operator: eq
    value: "200"
  - expression: res.body
    operator: eq
    value: "{{value}}"
```

`Get deleted key` expects `404`, and `Put value` and `Delete value` expect `200`. `Health` has no checks: any answer means the server is up.

## 2. Run it with the command line first

Start the example's server on your machine, and the same files run with `gostman run`:

```bash
cd examples/gostman
go tool httpkv/server &
gostman run collection --env Local --folder Write
gostman run collection --env Local --folder Verify
```

```text
PASS  PUT      Write/Put value  200 OK  45 ms  1/1 checks
      http://127.0.0.1:8080/kv/k1

Requests  1 passed
Checks    1 passed
Duration  52ms

PASS  GET      Verify/Health  200 OK  10 ms
      http://127.0.0.1:8080/health
PASS  GET      Verify/Get value  200 OK  0 ms  2/2 checks
      http://127.0.0.1:8080/kv/k1
PASS  GET      Verify/Get deleted key  404 Not Found  0 ms  1/1 checks
      http://127.0.0.1:8080/kv/k0
PASS  DELETE   Verify/Delete value  200 OK  2 ms  1/1 checks
      http://127.0.0.1:8080/kv/k1

Requests  4 passed
Checks    4 passed
Duration  31ms
```

Run `Verify` a second time and `Get value` fails, because the first run deleted `k1`. That is the kind of failure seedfall looks for, except that it causes it with crashes instead of a second run.

## 3. Run it under faults

The seedfall workload embeds the workspace, loads it with `runner.Load` and sends each request through one `runner.Session`. Each round it:

1. sends the `Write` folder while faults run, and resends it until its checks pass, so a pass is an acknowledged write;
2. lets the faults run for another second;
3. calls `sim.QuietFor`, which pauses faults and heals partitions, and sends the `Verify` folder. A request with no answer, because the server is still restarting, is sent again. A check that fails on an answer fails the seed.

`seedfall.json` runs the server with an fsync before every answer, under crashes, crashes in the middle of disk operations, torn writes and partitions:

```bash
cd examples/gostman
seedfall run -seeds 1-120
```

```text
property       seeds reached  seeds true
  always                120         120  Gostman checks pass once the faults stop
  sometimes             120          75  a fault interrupted a Gostman write

ok  120 seeds passed (0 hit the time horizon) in 6m18.878s
```

The `sometimes` line shows that the faults really reached the requests: in 75 of the 120 seeds a crash or a partition interrupted a write, and Gostman sent it again until it was acknowledged.

`seedfall.nofsync.json` starts the same server with `-fsync=false`. The first seed already fails, and the failure names the Gostman request and the checks that broke:

```bash
seedfall replay -c seedfall.nofsync.json -seed 1
```

```text
FAIL seed 1 at t=13.104695555s (108 scheduler steps, 29.398s real)
  client#1: Gostman checks pass once the faults stop: GET http://server:8080/kv/k6 (Verify/Get value)
  res.status equals 200: The value was 404
  res.body equals v6: The value was "404 page not found\n"

faults before the failure (7):
  292.108ms  partition [client] from the rest until 927.18ms
   1.7052s  crash server, restart at 1.849777s
  9.908868s  partition [server] from the rest until 11.461175s
  9.917569s  crash server, restart at 10.059483s
  11.087444s  crash server, restart at 11.229362s
  12.189396s  crash server, restart at 12.309456s
  12.752777s  crash server, restart at 12.794487s
```

The full trace that follows shows every request the collection sent, every crash and restart, and the server reporting `serving 0 keys` after the crash that lost the write. The same seed gives the same run every time, so `seedfall shrink -c seedfall.nofsync.json -seed 1` can cut the schedule down to the faults that matter.

## Use it with your own API

Copy `client/` and `collection.go` from the example next to your service's seedfall config, and replace `collection/` with your own workspace:

- Add an environment whose base URL uses the node name from `seedfall.json`, such as `http://api:8080`, and pick it with the client's `-env` flag.
- Put the requests that change state in one folder and the requests that check it in another, and name them with `-write` and `-verify`.
- Turn on `"net_overlay": true` in `seedfall.json`, so Gostman's ordinary HTTP client reaches the simulated network.

Requests that need the host, such as `{{$file(...)}}`, local commands or an OAuth 2.0 sign-in in a browser, cannot work inside the simulation. More in the seedfall [Gostman guide](https://github.com/kunalgoesbyken/seedfall/blob/main/docs/gostman.md).
