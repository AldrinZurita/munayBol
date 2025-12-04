export const environment = {
  production: false,
  // En local usamos '/api/' si tienes proxy, o la URL completa si prefieres.
  // Si tu proxy.conf.json redirige /api -> localhost:8000, déjalo así.
  // Si no estás seguro, pon 'http://localhost:8000' para ir a lo seguro.
  apiUrl: 'http://localhost:8000', 
  
  googleClientId: '643155360761-mvfq6qbbl1qbh6fthl933q74cgijb0pl.apps.googleusercontent.com',
  
  // URL local para que GitHub te devuelva a tu PC
  githubRedirectUri: 'http://localhost:4200/login'
};