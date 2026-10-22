import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { FormError, SelectField, SubmitButton, TextField } from '@/components/shared/form-fields'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { goalLabels, useSaveProfile, type NutritionProfile } from '@/features/nutrition/api'
import { useIsDesktop } from '@/hooks/use-media-query'
import { applyServerErrors, zodResolver } from '@/lib/form'

const year = new Date().getFullYear()
const schema = z.object({
  goal: z.enum(['cut', 'maintain', 'bulk']),
  sex: z.enum(['male', 'female']),
  birth_year: z.number({ error: 'Nhập năm sinh' }).int().min(year - 100, 'Năm sinh không hợp lệ').max(year - 10, 'Năm sinh không hợp lệ'),
  weight_kg: z.number({ error: 'Nhập cân nặng' }).min(20, 'Từ 20 kg').max(300, 'Tối đa 300 kg'),
  height_cm: z.number({ error: 'Nhập chiều cao' }).int().min(100, 'Từ 100 cm').max(250, 'Tối đa 250 cm'),
  workouts_per_week: z.number({ error: 'Nhập số buổi' }).int().min(0).max(14, 'Tối đa 14'),
})

const goalOptions = (Object.keys(goalLabels) as (keyof typeof goalLabels)[]).map((value) => ({ value, label: goalLabels[value] }))
const sexOptions = [
  { value: 'male' as const, label: 'Nam' },
  { value: 'female' as const, label: 'Nữ' },
]

export function ProfileSheet({ open, onOpenChange, profile }: { open: boolean; onOpenChange: (open: boolean) => void; profile: NutritionProfile | null }) {
  const isDesktop = useIsDesktop()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={isDesktop ? 'right' : 'bottom'} className="max-h-[90dvh] overflow-y-auto pb-[env(safe-area-inset-bottom)] max-lg:rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Hồ sơ dinh dưỡng</SheetTitle>
          <SheetDescription>Dùng để tính calo và protein mỗi ngày bằng công thức Mifflin-St Jeor.</SheetDescription>
        </SheetHeader>
        <ProfileForm key={open ? 'open' : 'closed'} profile={profile} onDone={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  )
}

function ProfileForm({ profile, onDone }: { profile: NutritionProfile | null; onDone: () => void }) {
  const save = useSaveProfile()
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: profile ?? { goal: 'maintain', sex: 'male', workouts_per_week: 3 },
  })

  const onSubmit = handleSubmit(async (values) => {
    try {
      await save.mutateAsync(values)
      toast.success('Đã lưu hồ sơ dinh dưỡng')
      onDone()
    } catch (error) {
      applyServerErrors(error, setError)
    }
  })

  const number = { valueAsNumber: true } as const

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4 px-4 pb-6">
      <FormError message={errors.root?.message} />
      <div className="grid grid-cols-2 gap-3">
        <Controller control={control} name="goal" render={({ field }) => <SelectField label="Mục tiêu" value={field.value} onChange={field.onChange} options={goalOptions} />} />
        <Controller control={control} name="sex" render={({ field }) => <SelectField label="Giới tính" value={field.value} onChange={field.onChange} options={sexOptions} />} />
        <TextField label="Năm sinh" type="number" inputMode="numeric" error={errors.birth_year?.message} {...register('birth_year', number)} />
        <TextField label="Cân nặng (kg)" type="number" inputMode="decimal" step="0.1" error={errors.weight_kg?.message} {...register('weight_kg', number)} />
        <TextField label="Chiều cao (cm)" type="number" inputMode="numeric" error={errors.height_cm?.message} {...register('height_cm', number)} />
        <TextField label="Buổi tập / tuần" type="number" inputMode="numeric" error={errors.workouts_per_week?.message} {...register('workouts_per_week', number)} />
      </div>
      <SubmitButton pending={isSubmitting}>Lưu và tính mục tiêu</SubmitButton>
    </form>
  )
}
