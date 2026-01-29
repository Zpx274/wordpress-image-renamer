import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();
    const appPassword = process.env.APP_PASSWORD;

    if (!appPassword) {
      // No password set, allow access
      return NextResponse.json({ success: true });
    }

    if (password === appPassword) {
      const response = NextResponse.json({ success: true });

      // Set a secure cookie that expires in 7 days
      response.cookies.set('app_auth', 'authenticated', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
      });

      return response;
    }

    return NextResponse.json(
      { success: false, error: 'Mot de passe incorrect' },
      { status: 401 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const appPassword = process.env.APP_PASSWORD;

  // If no password is set, no auth needed
  if (!appPassword) {
    return NextResponse.json({ authenticated: true, required: false });
  }

  const authCookie = request.cookies.get('app_auth');
  const isAuthenticated = authCookie?.value === 'authenticated';

  return NextResponse.json({
    authenticated: isAuthenticated,
    required: true
  });
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete('app_auth');
  return response;
}
