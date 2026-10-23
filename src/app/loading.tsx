// Permite que la pantalla de bienvenida (SplashScreen) aparezca al instante,
// sin esperar a que el servidor termine de validar la sesión.
export default function RootLoading() {
  return <div data-bp-loading className="min-h-screen bg-white" />;
}
