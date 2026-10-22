import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { categoriesQuery, useDeleteCategory, useSaveCategory, type Category } from '@/features/finance/api'
import { CategoryIcon } from '@/features/finance/CategoryIcon'
import { categoryColors } from '@/features/finance/labels'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { cn } from '@/lib/utils'

// System categories are listed read-only; the user's own can be added, renamed and deleted (if unused).
export function CategoryManager() {
  const online = useOnlineStatus()
  const categories = useQuery(categoriesQuery)
  const [type, setType] = useState<Category['type']>('expense')
  const list = (categories.data ?? []).filter((c) => c.type === type)

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Danh mục</h2>
        <div className="flex gap-1 rounded-lg border bg-card p-0.5 text-xs">
          {(['expense', 'income'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={cn('rounded-md px-2.5 py-1 font-medium', type === t ? 'bg-accent' : 'text-muted-foreground')}
            >
              {t === 'expense' ? 'Chi' : 'Thu'}
            </button>
          ))}
        </div>
      </div>
      <ul className="divide-y rounded-xl border bg-card">
        {list.map((c) => (
          <CategoryRow key={c.id} category={c} online={online} />
        ))}
        <NewCategoryRow type={type} online={online} />
      </ul>
    </section>
  )
}

function CategoryRow({ category, online }: { category: Category; online: boolean }) {
  const saveCategory = useSaveCategory()
  const deleteCategory = useDeleteCategory()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(category.name)

  async function rename() {
    try {
      await saveCategory.mutateAsync({ id: category.id, input: { name: name.trim() } })
      setEditing(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không lưu được')
    }
  }

  async function remove() {
    try {
      await deleteCategory.mutateAsync(category.id)
      toast.success(`Đã xoá "${category.name}"`)
    } catch (error) {
      // 409 explains how many transactions use it
      toast.error(error instanceof Error ? error.message : 'Không xoá được')
    }
  }

  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <CategoryIcon category={category} className="size-8" />
      {editing ? (
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={50} className="h-8 flex-1" autoFocus />
      ) : (
        <span className="flex-1 text-sm">{category.name}</span>
      )}
      {category.is_system ? (
        <span className="text-xs text-muted-foreground">Mặc định</span>
      ) : editing ? (
        <>
          <Button size="icon-sm" variant="ghost" aria-label="Lưu" disabled={!name.trim() || !online} onClick={rename}>
            <Check />
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label="Huỷ" onClick={() => setEditing(false)}>
            <X />
          </Button>
        </>
      ) : (
        <>
          <Button size="icon-sm" variant="ghost" aria-label={`Đổi tên ${category.name}`} disabled={!online} onClick={() => setEditing(true)}>
            <Pencil />
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label={`Xoá ${category.name}`} disabled={!online} onClick={remove}>
            <Trash2 />
          </Button>
        </>
      )}
    </li>
  )
}

function NewCategoryRow({ type, online }: { type: Category['type']; online: boolean }) {
  const saveCategory = useSaveCategory()
  const [name, setName] = useState('')
  const [color, setColor] = useState(categoryColors[0])

  async function add() {
    try {
      await saveCategory.mutateAsync({ input: { name: name.trim(), type, color } })
      setName('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thêm được')
    }
  }

  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex items-center gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && name.trim() && add()}
          maxLength={50}
          placeholder={type === 'expense' ? 'Danh mục chi mới, VD: Cà phê' : 'Danh mục thu mới, VD: Làm thêm'}
          className="h-9 flex-1"
        />
        <Button size="sm" disabled={!name.trim() || !online || saveCategory.isPending} onClick={add}>
          <Plus />
          Thêm
        </Button>
      </div>
      <div className="flex gap-1.5" role="radiogroup" aria-label="Màu">
        {categoryColors.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={color === c}
            aria-label={c}
            onClick={() => setColor(c)}
            className={cn('size-5 rounded-full ring-offset-2 ring-offset-card', color === c && 'ring-2 ring-foreground')}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
    </li>
  )
}
