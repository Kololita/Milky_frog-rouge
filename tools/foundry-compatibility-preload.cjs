const flags = process.argv;

if (flags.includes('--naiwa-no-float-timers')) {
  const proto = WebGL2RenderingContext.prototype;
  const getExtension = proto.getExtension;
  const unavailable = new Set(['EXT_color_buffer_float', 'EXT_disjoint_timer_query_webgl2']);
  proto.getExtension = function(name) {
    return unavailable.has(name) ? null : getExtension.call(this, name);
  };
}

if (flags.includes('--naiwa-low-power')) {
  const proto = HTMLCanvasElement.prototype;
  const getContext = proto.getContext;
  proto.getContext = function(type,options) {
    if (type === 'webgl2') options = {...options,powerPreference:'low-power'};
    return getContext.call(this,type,options);
  };
}
