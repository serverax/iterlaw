'use client'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
const OAUTH_PROVIDERS = [
  { id: 'google', label: 'Sign in with Google', icon: '🔍' },
  { id: 'linkedin_oidc', label: 'Sign in with LinkedIn', icon: '💼' },
  { id: 'microsoft', label: 'Sign in with Microsoft', icon: '🪟' },
  { id: 'apple', label: 'Sign in with Apple', icon: '🍎' },
  { id: 'facebook', label: 'Sign in with Facebook', icon: '👥' },
]
export default function LoginPage() {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const handleOAuthSignIn = async (provider: string) => {
    try {
      setLoading(true)
      setError(null)
      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider as any,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) {
        setError(error.message)
      }
    } catch (err) {
      setError('An error occurred during sign in')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }
  return (
    <div style={{
      width: '100%',
      maxWidth: '400px',
      padding: '2rem',
      background: '#1A1D26',
      borderRadius: '12px',
      border: '1px solid #252836',
    }}>
      <h1 style={{
        fontSize: '24px',
        fontWeight: 'bold',
        marginBottom: '0.5rem',
        color: '#F0EDE6',
      }}>
        Know your rights
      </h1>
      <p style={{
        fontSize: '14px',
        color: '#9A97A0',
        marginBottom: '2rem',
      }}>
        Sign in to your account to continue
      </p>
      {error && (
        <div style={{
          padding: '12px',
          marginBottom: '1rem',
          background: '#E05555',
          color: '#fff',
          borderRadius: '8px',
          fontSize: '14px',
        }}>
          {error}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {OAUTH_PROVIDERS.map((provider) => (
          <button
            key={provider.id}
            onClick={() => handleOAuthSignIn(provider.id)}
            disabled={loading}
            style={{
              padding: '12px 16px',
              background: '#252836',
              color: '#F0EDE6',
              border: '1px solid #5C5A65',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'all 0.2s',
              opacity: loading ? 0.6 : 1,
            }}
            onMouseOver={(e) => {
              if (!loading) {
                (e.target as HTMLButtonElement).style.background = '#2F3139'
              }
            }}
            onMouseOut={(e) => {
              (e.target as HTMLButtonElement).style.background = '#252836'
            }}
          >
            {provider.icon} {provider.label}
          </button>
        ))}
      </div>
      <p style={{
        fontSize: '12px',
        color: '#5C5A65',
        marginTop: '2rem',
        textAlign: 'center',
        lineHeight: '1.5',
      }}>
        By signing in, you agree to our Privacy Policy and Terms of Service
      </p>
      <div style={{
        padding: '12px',
        marginTop: '1.5rem',
        background: '#FFF8E1',
        color: '#3D3D3A',
        borderRadius: '8px',
        fontSize: '12px',
        lineHeight: '1.5',
      }}>
        <strong>⚠️ Important:</strong> This app provides employment law guidance based on UK Government sources and AI. This is NOT professional legal advice. Always consult a qualified employment solicitor.
      </div>
    </div>
  )
}
