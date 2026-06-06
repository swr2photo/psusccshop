import { db } from '@/lib/db'
import { todos } from '@/db/schema'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const data = await db.select().from(todos)

  return (
    <ul style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      {data?.map((todo: any) => (
        <li key={todo.id}>{todo.name}</li>
      ))}
    </ul>
  )
}
