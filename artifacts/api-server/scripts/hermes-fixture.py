"""Synthetic integration probe, not an OS sandbox or a production worker."""
import json
import os
import socket
import subprocess
import threading
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

requests_seen = []
blocked_network = []
blocked_processes = []
stage = "mock-provider"


class Provider(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0"))
        if self.path != "/v1/chat/completions" or not 0 < length <= 131072:
            self.send_error(400)
            return
        body = json.loads(self.rfile.read(length))
        requests_seen.append(body)
        if body.get("model") != "hermes-fixture" or body.get("tools"):
            self.send_error(400)
            return
        choice = {"index": 0, "message": {"role": "assistant",
                  "content": "METADATA_FIXTURE_OK"}, "finish_reason": "stop"}
        if body.get("stream"):
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.end_headers()
            chunk = {"id": "fixture", "object": "chat.completion.chunk",
                     "created": 0, "model": "hermes-fixture", "choices": [{
                         "index": 0, "delta": choice["message"], "finish_reason": None}]}
            end = {**chunk, "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}]}
            for item in [chunk, end]:
                self.wfile.write(("data: " + json.dumps(item) + "\n\n").encode())
            self.wfile.write(b"data: [DONE]\n\n")
            self.wfile.flush()
        else:
            payload = json.dumps({
                "id": "fixture", "object": "chat.completion", "created": 0,
                "model": "hermes-fixture", "choices": [choice],
                "usage": {"prompt_tokens": 20, "completion_tokens": 5, "total_tokens": 25},
            }).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)


server = ThreadingHTTPServer(("127.0.0.1", 0), Provider)
port = server.server_address[1]
threading.Thread(target=server.serve_forever, daemon=True).start()
original_dns = socket.getaddrinfo
original_connect = socket.socket.connect
original_connect_ex = socket.socket.connect_ex


def dns(host, target_port, *args, **kwargs):
    if host != "127.0.0.1" or int(target_port) != port:
        blocked_network.append("dns")
        raise PermissionError("Fixture allows only its local mock provider")
    return original_dns(host, target_port, *args, **kwargs)


def connection(fn):
    def guarded(sock, address):
        if not isinstance(address, tuple) or address[:2] != ("127.0.0.1", port):
            blocked_network.append("connect")
            raise PermissionError("Fixture allows only its local mock provider")
        return fn(sock, address)
    return guarded


def deny_process(*args, **_kwargs):
    command = args[0] if args else ""
    if isinstance(command, (list, tuple)):
        command = command[0] if command else ""
    blocked_processes.append({
        "program": os.path.basename(str(command)),
        "caller": [os.path.basename(frame.filename) + ":" + frame.name
                   for frame in traceback.extract_stack(limit=5)[:-1]],
    })
    raise PermissionError("Fixture disables child processes")


# Test guards are installed before importing Hermes; never call this a sandbox.
socket.getaddrinfo = dns
socket.socket.connect = connection(original_connect)
socket.socket.connect_ex = connection(original_connect_ex)
subprocess.Popen = deny_process
os.system = deny_process
for name in ("execv", "execve", "execvp", "execvpe", "posix_spawn", "posix_spawnp"):
    if hasattr(os, name):
        setattr(os, name, deny_process)

agent = None
ok = False
try:
    stage = "import"
    from run_agent import AIAgent
    stage = "initialize"
    agent = AIAgent(
        base_url=f"http://127.0.0.1:{port}/v1",
        api_key="synthetic-fixture-key-not-a-real-credential",
        provider="custom", api_mode="chat_completions", model="hermes-fixture",
        enabled_toolsets=[], disabled_toolsets=["memory"],
        skip_memory=True, skip_background_review=True, skip_context_files=True,
        load_soul_identity=False, save_trajectories=False, checkpoints_enabled=False,
        quiet_mode=True, max_iterations=2, max_tokens=128, run_budget_seconds=15,
    )
    assert not agent.tools and not agent.valid_tool_names
    stage = "conversation"
    metadata = {"synthetic": True, "id": "SYNTHETIC_DOC",
                "doc_type": "surat_pernyataan", "has_document_number": False}
    result = agent.run_conversation(json.dumps(metadata))
    stage = "assertions"
    assert result.get("completed") is True
    assert result.get("final_response", "").strip() == "METADATA_FIXTURE_OK"
    assert len(requests_seen) == 1
    assert "SYNTHETIC_DOC" in json.dumps(requests_seen[0].get("messages", []))
    assert not agent.tools and not blocked_network
    # Python's platform.processor() may try `uname`; it stays denied.
    # Permit this observed *blocked attempt*, never process execution.
    assert len(blocked_processes) <= 1
    assert all(item["program"] == "uname"
               and "platform.py:from_subprocess" in item["caller"]
               for item in blocked_processes)
    ok = True
except Exception as exc:
    # Fixtures contain no application secrets; report only error type, not SDK bodies.
    print(json.dumps({"hermesFixture": True, "ok": False, "stage": stage,
                      "errorType": type(exc).__name__,
                      "networkAttemptsBlocked": len(blocked_network),
                      "processAttemptsBlocked": len(blocked_processes),
                      "blockedProcesses": blocked_processes}))
finally:
    if agent is not None and callable(getattr(agent, "close", None)):
        agent.close()
    server.shutdown()
    server.server_close()
if ok:
    print(json.dumps({"hermesFixture": True, "ok": True, "requests": 1,
                      "tools": 0, "data": "synthetic-only", "provider": "local-mock",
                      "processAttemptsBlocked": len(blocked_processes),
                      "claudeConnection": "not-tested"}))
raise SystemExit(0 if ok else 1)
