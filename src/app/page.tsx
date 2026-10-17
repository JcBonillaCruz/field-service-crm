export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-brand-navy">
      {/* Logo / Brand */}
      <div className="text-center">
        <div className="mb-6">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-brand-orange flex items-center justify-center">
            <svg
              className="w-10 h-10 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>
        </div>

        <h1 className="text-4xl font-bold text-white mb-2">
          Field Service CRM
        </h1>

        <p className="text-lg text-gray-300 mb-8 max-w-md mx-auto">
          Sistema profesional para compañías de servicios en campo.
          <br />
          Facturación · Inventario · Despacho
        </p>

        <div className="space-y-3">
          <button className="w-64 bg-brand-orange hover:bg-brand-orange-light text-white font-semibold py-3 px-6 rounded-lg transition-colors">
            Iniciar Sesión
          </button>

          <p className="text-gray-400 text-sm">
            ¿No tienes cuenta?{" "}
            <span className="text-brand-orange cursor-pointer hover:underline">
              Regístrate gratis
            </span>
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-6 text-center">
        <p className="text-gray-500 text-xs">
          © 2026 Field Service CRM · Todos los derechos reservados
        </p>
        <p className="text-gray-600 text-xs mt-1">v0.1.0</p>
      </div>
    </div>
  );
}
