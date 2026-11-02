// Windows desktop app (also works on macOS/Linux): opens a native window that shows web/index.html
// and talks DIRECTLY to the C++ engine (Campus.hpp) through cg_exec(). Windows uses the built-in WebView2.
#include <cstdlib>
#include <fstream>
#include <iostream>
#include <sstream>
#include "../include/Campus.hpp"
#include "webview/webview.h"

static std::string readFile(const std::string& p) {
    std::ifstream f(p, std::ios::binary); if (!f) { std::cerr << "Cannot open " << p << "\n"; return ""; }
    std::stringstream s; s << f.rdbuf(); return s.str();
}
static void replaceAll(std::string& s, const std::string& a, const std::string& b) {
    for (size_t p = s.find(a); p != std::string::npos; p = s.find(a, p + b.size())) s.replace(p, a.size(), b);
}
int main() {
    const std::string dir = WEB_DIR;                    // set by the build script (forward slashes)
    std::string html = readFile(dir + "/index.html");
    replaceAll(html, "<link rel=\"stylesheet\" href=\"style.css\">", "<style>" + readFile(dir + "/style.css") + "</style>");
    replaceAll(html, "<script src=\"engine.js\"></script>", "");       // the desktop app uses the C++ engine, not the JS mirror
    replaceAll(html, "<script src=\"app.js\"></script>", "<script>" + readFile(dir + "/app.js") + "</script>");

    Campus campus;
    webview::webview w(std::getenv("CG_DEBUG") != nullptr, nullptr);   // set CG_DEBUG=1 to enable right-click Inspect
    w.set_title("CampusGuard - Smart Campus Evacuation");
    w.set_size(480, 860, WEBVIEW_HINT_NONE);
    w.bind("cg_exec", [&](const std::string& req) -> std::string {
        // req looks like ["route R101 exit"]  ->  strip [" and "] and un-escape \"
        std::string cmd = req.size() >= 4 ? req.substr(2, req.size() - 4) : "";
        replaceAll(cmd, "\\\"", "\"");
        return campus.exec(cmd);                        // engine returns JSON; JS receives it as an object
    });
    w.set_html(html);
    w.run();
}
