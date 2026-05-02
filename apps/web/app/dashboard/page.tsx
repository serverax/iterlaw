'use client'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
    }
    getUser()
  }, [supabase.auth])
  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.refresh()
    router.push('/auth/login')
  }
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0D0F14',
        color: '#F0EDE6',
      }}>
        Loading...
      </div>
    )
  }
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0D0F14',
      color: '#F0EDE6',
      padding: '2rem',
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '3rem',
        }}>
          <div>
            <h1 style={{ fontSize: '32px', fontWeight: 'bold' }}>Dashboard</h1>
            <p style={{ color: '#9A97A0', marginTop: '0.5rem' }}>
              Welcome, {user?.email}
            </p>
          </div>
          <button
            onClick={handleSignOut}
            style={{
              padding: '10px 20px',
              background: '#E05555',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '500',
            }}
          >
            Sign Out
          </button>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '1.5rem',
        }}>
          <div style={{
            background: '#1A1D26',
            padding: '1.5rem',
            borderRadius: '12px',
            border: '1px solid #252836',
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              Ask a Question
            </h2>
            <p style={{ color: '#9A97A0', marginBottom: '1rem' }}>
              Get guidance on employment law
            </p>
            <button style={{
              padding: '10px 16px',
              background: '#C9A84C',
              color: '#0D0F14',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '500',
            }}>
              Ask Now
            </button>
          </div>
          <div style={{
            background: '#1A1D26',
            padding: '1.5rem',
            borderRadius: '12px',
            border: '1px solid #252836',
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              My Cases
            </h2>
            <p style={{ color: '#9A97A0', marginBottom: '1rem' }}>
              Track your workplace disputes
            </p>
            <button style={{
              padding: '10px 16px',
              background: '#252836',
              color: '#F0EDE6',
              border: '1px solid #5C5A65',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '500',
            }}>
              View Cases
            </button>
          </div>
          <div style={{
            background: '#1A1D26',
            padding: '1.5rem',
            borderRadius: '12px',
            border: '1px solid #252836',
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              Settings
            </h2>
            <p style={{ color: '#9A97A0', marginBottom: '1rem' }}>
              Privacy, billing, account
            </p>
            <button style={{
              padding: '10px 16px',
              background: '#252836',
              color: '#F0EDE6',
              border: '1px solid #5C5A65',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '500',
            }}>
              Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
