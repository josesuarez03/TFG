import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';

export default function Login() {
    const router = useRouter();
    const { login, error: authError, loading } = useAuth();
    const [formData, setFormData] = useState({
        email: '',
        password: '',
    });
    const [error, setError] = useState('');
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({
          ...formData,
          [e.target.name]: e.target.value,
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        
        if (!formData.email || !formData.password) {
          setError('Por favor, complete todos los campos');
          return;
        }

        try {
            await login(formData.email, formData.password);
            router.push('/dashboard');
          } catch (err) {
            console.error('Error logging in:', err);
        }
    };


    const handleGoogleSuccess = async (credentialResponse: any) => {
        try {
          // Your API service would need to handle this token
          await API.post('auth/google/', { token: credentialResponse.credential });
          router.push('/dashboard');
        } catch (err) {
          console.error('Error with Google login:', err);
          setError('Error al iniciar sesión con Google');
        }
    };

    return (
        
    )
}