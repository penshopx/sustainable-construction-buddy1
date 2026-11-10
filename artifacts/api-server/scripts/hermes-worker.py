"""Preview worker. No provider credentials, member JWT, DB, file tools or persistence."""
import json
import os
import socket
import subprocess
import sys
from urllib.parse import urlsplit

payload = json.loads(sys.stdin.buffer.read(32769))
endpoint = urlsplit(payload["endpoint"])
if endpoint.hostname != "127.0.0.1" or endpoint.scheme != "http" or not endpoint.port:
    raise SystemExit(1)
port = endpoint.port
dns = socket.getaddrinfo
connect = socket.socket.connect
connect_ex = socket.socket.connect_ex


def allowed(address):
    return isinstance(address, tuple) and address[:2] == ("127.0.0.1", port)


def guarded_dns(host, target_port, *args, **kwargs):
    if host != "127.0.0.1" or int(target_port) != port:
        raise PermissionError("Network disabled")
    return dns(host, target_port, *args, **kwargs)


def guard(fn):
    def run(sock, address):
        if not allowed(address):
            raise PermissionError("Network disabled")
        return fn(sock, address)
    return run


def no_process(*_args, **_kwargs):
    raise PermissionError("Processes disabled")


socket.getaddrinfo = guarded_dns
socket.socket.connect = guard(connect)
socket.socket.connect_ex = guard(connect_ex)
subprocess.Popen = no_process
os.system = no_process
for name in ("execv", "execve", "execvp", "execvpe", "posix_spawn", "posix_spawnp"):
    if hasattr(os, name):
        setattr(os, name, no_process)

agent = None
try:
    from run_agent import AIAgent
    agent = AIAgent(
        base_url=payload["endpoint"], api_key=payload["capability"],
        provider="custom", api_mode="chat_completions", model="pilot-claude",
        enabled_toolsets=[], disabled_toolsets=["memory"],
        skip_memory=True, skip_background_review=True, skip_context_files=True,
        load_soul_identity=False, save_trajectories=False, checkpoints_enabled=False,
        quiet_mode=True, max_iterations=2, max_tokens=1800, run_budget_seconds=70,
        fallback_model=None,
    )
    if agent.tools or agent.valid_tool_names:
        raise RuntimeError("Tools must be disabled")
    result = agent.run_conversation(json.dumps(payload["metadata"], ensure_ascii=False))
    answer = result.get("final_response")
    if result.get("completed") is not True or agent.tools or not isinstance(answer, str):
        raise RuntimeError("Incomplete result")
    print("PUB_PILOT_RESULT:" + json.dumps({"completed": True, "analysis": answer}))
except Exception:
    # Never echo SDK exceptions, prompt bodies, or capability tokens.
    raise SystemExit(1)
finally:
    if agent is not None and callable(getattr(agent, "close", None)):
        agent.close()
