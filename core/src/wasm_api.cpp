// Bridge: the phone app calls cg_exec("route R101 exit") and gets JSON back.
#include "../include/Campus.hpp"
#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#define CG_EXPORT EMSCRIPTEN_KEEPALIVE
#else
#define CG_EXPORT
#endif
static Campus* app = nullptr; static std::string out;
extern "C" CG_EXPORT const char* cg_exec(const char* cmd) { if (!app) app = new Campus(); out = app->exec(cmd); return out.c_str(); }
