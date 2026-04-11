import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuthStore } from '../../store/authStore';
import api from '../../lib/axios';

const loginSchema = z.object({
  username: z.string().min(1, 'El usuario es requerido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    try {
      setError(null);
      const response = await api.post('/api/auth/login/', data);
      
      const { access, user } = response.data;
      setAuth(user, access);
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Credenciales inválidas. Intente nuevamente.');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="surface-card w-full max-w-md p-10 sm:p-12">
        <div className="text-center">
          <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl bg-[linear-gradient(135deg,#2347a5_0%,#356fef_100%)] text-white shadow-[0_12px_24px_rgba(35,71,165,0.2)]">
            <span className="text-2xl font-black tracking-wider">A</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            Bienvenido a Argos
          </h2>
          <p className="muted-copy mt-2 text-sm">
            Ingresa tus credenciales para acceder al sistema
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-5">
            <div>
              <label htmlFor="username" className="field-label">Usuario</label>
              <input
                id="username"
                type="text"
                {...register('username')}
                className="field-input w-full"
                placeholder="Ej. admin"
              />
              {errors.username && (
                <p className="mt-2 text-sm text-red-500 font-medium">{errors.username.message}</p>
              )}
            </div>
            
            <div>
              <label htmlFor="password" className="field-label">Contraseña</label>
              <input
                id="password"
                type="password"
                {...register('password')}
                className="field-input w-full"
                placeholder="••••••••"
              />
              {errors.password && (
                <p className="mt-2 text-sm text-red-500 font-medium">{errors.password.message}</p>
              )}
            </div>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <h3 className="text-sm font-semibold text-red-800 text-center">{error}</h3>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="primary-button w-full"
            >
              {isSubmitting ? 'Iniciando sesión...' : 'Ingresar al sistema'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
