import { redirect } from 'next/navigation';

/** Demo route removed — redirect to home. */
export default function TodoPage() {
  redirect('/');
}
