import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'Aucun fichier fourni' },
        { status: 400 }
      );
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json(
        { success: false, error: 'Le fichier doit être un PDF' },
        { status: 400 }
      );
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Dynamic import to avoid ESM issues
    const pdfParse = require('pdf-parse');

    // Extract text from PDF
    const data = await pdfParse(buffer);

    return NextResponse.json({
      success: true,
      text: data.text,
      pages: data.numpages,
    });
  } catch (error) {
    console.error('Erreur extraction PDF:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la lecture du PDF' },
      { status: 500 }
    );
  }
}
