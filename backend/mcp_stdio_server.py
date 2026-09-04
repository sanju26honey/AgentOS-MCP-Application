import sys
import json
import logging
from typing import Dict, Any, Optional
from backend.mcp_server import mcp_server_instance

# Configure logger to output only to stderr so stdout remains clean JSON-RPC protocol
logger = logging.getLogger("mcp_stdio_server")
logging.basicConfig(stream=sys.stderr, level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

def handle_jsonrpc_request(request: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Processes incoming Model Context Protocol (MCP) JSON-RPC 2.0 message."""
    msg_id = request.get("id")
    method = request.get("method", "")
    params = request.get("params", {})

    # If message is a notification (no id) or notification method, do not respond
    if msg_id is None or method.startswith("notifications/"):
        return None

    if method == "initialize":
        return {
            "jsonrpc": "2.0",
            "id": msg_id,
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {
                    "tools": {}
                },
                "serverInfo": {
                    "name": "Universal AI-Commerce Adapter MCP Server",
                    "version": "1.0.0"
                }
            }
        }
    elif method == "ping" or method == "logging/setLevel":
        return {
            "jsonrpc": "2.0",
            "id": msg_id,
            "result": {}
        }
    elif method == "tools/list":
        tools = mcp_server_instance.get_tools_manifest()
        return {
            "jsonrpc": "2.0",
            "id": msg_id,
            "result": {
                "tools": tools
            }
        }
    elif method == "tools/call":
        tool_name = params.get("name")
        arguments = params.get("arguments", {})
        
        exec_res = mcp_server_instance.execute_tool(name=tool_name, arguments=arguments)
        is_error = exec_res.get("isError", False)
        
        return {
            "jsonrpc": "2.0",
            "id": msg_id,
            "result": {
                "content": [
                    {
                        "type": "text",
                        "text": json.dumps(exec_res.get("result", exec_res), indent=2)
                    }
                ],
                "isError": is_error
            }
        }
    else:
        return {
            "jsonrpc": "2.0",
            "id": msg_id,
            "result": {}
        }

def run_stdio_server():
    """Main loop listening on sys.stdin and writing JSON-RPC 2.0 responses to sys.stdout."""
    logger.info("Universal AI-Commerce Adapter MCP Stdio Server Started. Listening on stdin...")
    
    for line in sys.stdin:
        line_str = line.strip()
        if not line_str:
            continue
        try:
            req = json.loads(line_str)
            resp = handle_jsonrpc_request(req)
            if resp is not None:
                sys.stdout.write(json.dumps(resp) + "\n")
                sys.stdout.flush()
        except Exception as e:
            logger.error(f"Error processing stdio input: {e}")
            err_resp = {
                "jsonrpc": "2.0",
                "id": None,
                "error": {
                    "code": -32700,
                    "message": f"Parse error or invalid JSON: {e}"
                }
            }
            sys.stdout.write(json.dumps(err_resp) + "\n")
            sys.stdout.flush()

if __name__ == "__main__":
    run_stdio_server()
