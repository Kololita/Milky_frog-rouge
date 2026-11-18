"""Compile runtime particle shaders with a hidden native OpenGL context.
No browser is launched and no window is shown. No packages are required.
"""
import ctypes as c,json
from ctypes import wintypes as w
from pathlib import Path
root=Path(__file__).resolve().parents[1]
user=c.WinDLL('user32');gdi=c.WinDLL('gdi32');gl=c.WinDLL('opengl32')
user.CreateWindowExW.argtypes=[w.DWORD,w.LPCWSTR,w.LPCWSTR,w.DWORD,c.c_int,c.c_int,c.c_int,c.c_int,w.HWND,w.HMENU,w.HINSTANCE,c.c_void_p];user.CreateWindowExW.restype=w.HWND
user.GetDC.argtypes=[w.HWND];user.GetDC.restype=w.HDC
user.ReleaseDC.argtypes=[w.HWND,w.HDC];user.DestroyWindow.argtypes=[w.HWND]
gdi.ChoosePixelFormat.argtypes=[w.HDC,c.c_void_p];gdi.SetPixelFormat.argtypes=[w.HDC,c.c_int,c.c_void_p]
gl.wglCreateContext.argtypes=[w.HDC];gl.wglCreateContext.restype=c.c_void_p
gl.wglMakeCurrent.argtypes=[w.HDC,c.c_void_p];gl.wglDeleteContext.argtypes=[c.c_void_p]
gl.wglGetProcAddress.argtypes=[c.c_char_p];gl.wglGetProcAddress.restype=c.c_void_p
window=user.CreateWindowExW(0,'STATIC','Shader validation',0x80000000,0,0,16,16,None,None,None,None)
dc=user.GetDC(window);pfd=c.create_string_buffer(40);c.c_ushort.from_buffer(pfd,0).value=40;c.c_ushort.from_buffer(pfd,2).value=1;c.c_uint.from_buffer(pfd,4).value=0x25;pfd[9]=bytes([24]);pfd[23]=bytes([24])
fmt=gdi.ChoosePixelFormat(dc,pfd);assert fmt and gdi.SetPixelFormat(dc,fmt,pfd),'Native pixel format unavailable'
context=gl.wglCreateContext(dc);assert context and gl.wglMakeCurrent(dc,context),'Native OpenGL context unavailable'
def proc(name,result,*args):
 address=gl.wglGetProcAddress(name.encode());assert address and address not in [1,2,3,c.c_void_p(-1).value],name
 return c.WINFUNCTYPE(result,*args)(address)
create=proc('glCreateShader',c.c_uint,c.c_uint);source=proc('glShaderSource',None,c.c_uint,c.c_int,c.POINTER(c.c_char_p),c.c_void_p);compile_=proc('glCompileShader',None,c.c_uint)
shader_status=proc('glGetShaderiv',None,c.c_uint,c.c_uint,c.POINTER(c.c_int));shader_log=proc('glGetShaderInfoLog',None,c.c_uint,c.c_int,c.c_void_p,c.c_char_p)
create_program=proc('glCreateProgram',c.c_uint);attach=proc('glAttachShader',None,c.c_uint,c.c_uint);link=proc('glLinkProgram',None,c.c_uint)
program_status=proc('glGetProgramiv',None,c.c_uint,c.c_uint,c.POINTER(c.c_int));program_log=proc('glGetProgramInfoLog',None,c.c_uint,c.c_int,c.c_void_p,c.c_char_p)
try:
 results=[]
 shader_files=[root/'output/animations/gpu-particle-shaders.json',root/'output/animations/rage-eye-shaders.json',root/'output/animations/camera-occlusion-shaders.json']
 shaders=[]
 for path in shader_files:
  if path.exists():shaders.extend(json.loads(path.read_text(encoding='utf-8')))
 for item in shaders:
  program=create_program()
  for key,kind in [('vertex',0x8B31),('fragment',0x8B30)]:
   shader=create(kind);encoded=item[key].encode();value=c.c_char_p(encoded);source(shader,1,c.byref(value),None);compile_(shader)
   status=c.c_int();shader_status(shader,0x8B81,c.byref(status));log=c.create_string_buffer(16384);shader_log(shader,len(log),None,log)
   assert status.value,f'{item["name"]} {key}: {log.value.decode(errors="replace")}'
   attach(program,shader)
  link(program);status=c.c_int();program_status(program,0x8B82,c.byref(status));log=c.create_string_buffer(16384);program_log(program,len(log),None,log)
  assert status.value,f'{item["name"]} link: {log.value.decode(errors="replace")}'
  results.append({'name':item['name'],'compiled':True,'linked':True})
 (root/'output/animations/gpu-shader-compilation.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
 print('GPU_SHADERS_COMPILED',json.dumps(results))
finally:
 gl.wglMakeCurrent(None,None);gl.wglDeleteContext(context);user.ReleaseDC(window,dc);user.DestroyWindow(window)
