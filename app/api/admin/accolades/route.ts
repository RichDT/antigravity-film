import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { query } from '@/lib/db';

async function requireAdmin() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return !!data.user;
}

export async function POST(request: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { film_id, source, label } = await request.json();
  if (!film_id || !source || !label) {
    return NextResponse.json({ error: 'film_id, source, and label are required' }, { status: 400 });
  }

  const res = await query(
    `INSERT INTO film_accolades (film_id, source, label) VALUES ($1, $2, $3) RETURNING accolade_id`,
    [film_id, source.trim().toLowerCase(), label.trim()]
  );

  revalidatePath('/');
  return NextResponse.json({ success: true, accolade_id: res.rows[0].accolade_id });
}

export async function DELETE(request: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { accolade_id } = await request.json();
  if (!accolade_id) {
    return NextResponse.json({ error: 'accolade_id is required' }, { status: 400 });
  }

  await query(`DELETE FROM film_accolades WHERE accolade_id = $1`, [accolade_id]);

  revalidatePath('/');
  return NextResponse.json({ success: true });
}
