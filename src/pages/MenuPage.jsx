import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRMS, update, recipeCost, productCost, logAudit } from '../lib/rmsData'
import { PageHeader, Card, Badge, Btn, Modal, Field, inputCls, Select, SearchInput, useDebounce, useCurrency, toast, Tabs } from '../components/ui'
import { Plus, Pencil, Archive, ArrowUp, ArrowDown, Search } from 'lucide-react'

const STATIONS = ['Main Kitchen', 'Grill', 'Fryer', 'Pizza', 'Drinks', 'Dessert']

export default function MenuPage() {
  const s = useRMS()
  const cur = useCurrency()
  const [tab, setTab] = useState('products')
  const [catFilter, setCatFilter] = useState('all')
  const [q, setQ] = useState('')
  const dq = useDebounce(q)
  const [editOpen, setEditOpen] = useState(false)
  const [editProduct, setEditProduct] = useState(null)
  const [catOpen, setCatOpen] = useState(false)
  const [newCat, setNewCat] = useState('')
  const [mgOpen, setMgOpen] = useState(false)
  const [mgForm, setMgForm] = useState({ name: '', modifiers: [{ name: '', price: '' }] })

  const products = useMemo(() => {
    let list = [...s.products].sort((a, b) => {
      const ca = s.categories.find((c) => c.id === a.category_id)?.sort || 0
      const cb = s.categories.find((c) => c.id === b.category_id)?.sort || 0
      return ca - cb || a.name.localeCompare(b.name)
    })
    if (catFilter !== 'all') list = list.filter((p) => p.category_id === catFilter)
    if (dq) list = list.filter((p) => p.name.toLowerCase().includes(dq.toLowerCase()) || p.sku.toLowerCase().includes(dq.toLowerCase()))
    return list
  }, [s.products, s.categories, catFilter, dq])

  const saveProduct = (form) => {
    const recipe = form.recipe || []
    if (recipe.some((row) => !s.ingredients.some((ingredient) => ingredient.id === row.ingredient_id) || !Number.isFinite(Number(row.qty)) || Number(row.qty) <= 0)) {
      toast('Each recipe line must select an inventory ingredient and a positive amount per product', 'error')
      return
    }
    const normalizedRecipe = recipe.map((row) => ({ ...row, qty: Number(row.qty) }))
    update((st) => {
      if (form.id) {
        const p = st.products.find((x) => x.id === form.id)
        const prev = cur(p.price)
        Object.assign(p, { ...form, price: Number(form.price), cost: Number(form.cost) })
        st.recipes[p.id] = normalizedRecipe
        logAudit(st, { user: 'Manager', action: 'update', entity: 'product', entity_id: p.name, prev, new: cur(p.price) })
      } else {
        const id = `prd_${Math.random().toString(36).slice(2, 9)}`
        st.products.push({ ...form, id, price: Number(form.price), cost: Number(form.cost), available: true, sort: 0 })
        st.recipes[id] = normalizedRecipe
        logAudit(st, { user: 'Manager', action: 'create', entity: 'product', entity_id: form.name })
      }
    })
    setEditOpen(false)
    toast('Product saved')
  }

  const move = (p, dir) => {
    update((st) => {
      const list = st.products.filter((x) => x.category_id === p.category_id)
      const idx = list.findIndex((x) => x.id === p.id)
      const swap = list[idx + dir]
      if (!swap) return
      const a = st.products.find((x) => x.id === p.id)
      const b = st.products.find((x) => x.id === swap.id)
      const t = a.sort; a.sort = b.sort; b.sort = t
    })
  }

  return (
    <div>
      <PageHeader title="Menu Management" subtitle="Products, categories, recipes and food costing"
        actions={<>
          <SearchInput value={q} onChange={setQ} placeholder="Search menu…" className="w-52" />
          <Btn variant="secondary" onClick={() => setCatOpen(true)}><Plus size={15} /> Category</Btn>
          <Btn onClick={() => { setEditProduct(null); setEditOpen(true) }}><Plus size={15} /> Product</Btn>
        </>} />

      <Tabs active={tab} onChange={setTab} tabs={[
        { key: 'products', label: 'Products' },
        { key: 'categories', label: 'Categories' },
        { key: 'modifiers', label: 'Modifier Groups' },
        { key: 'foodcost', label: 'Food Costing' },
      ]} />

      {tab === 'products' && (
        <>
          <div className="flex gap-1.5 flex-wrap mb-4">
            <Btn size="sm" variant={catFilter === 'all' ? 'primary' : 'secondary'} onClick={() => setCatFilter('all')}>All</Btn>
            {s.categories.map((c) => (
              <Btn key={c.id} size="sm" variant={catFilter === c.id ? 'primary' : 'secondary'} onClick={() => setCatFilter(c.id)}>{c.name}</Btn>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {products.map((p) => {
              const cost = productCost(s, p)
              const margin = p.price > 0 ? ((p.price - cost) / p.price) * 100 : 0
              return (
                <div key={p.id} className={`bg-white border rounded-xl p-4 shadow-sm ${p.available ? 'border-gray-200' : 'border-gray-200 opacity-50'}`}>
                  <div className="flex items-start justify-between">
                    <span className="text-3xl">{p.emoji}</span>
                    <Badge color={p.available ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}>{p.available ? 'Active' : 'Archived'}</Badge>
                  </div>
                  <p className="font-semibold text-gray-900 mt-2">{p.name}</p>
                  <p className="text-xs text-gray-400">{p.sku} · {s.categories.find((c) => c.id === p.category_id)?.name} · {p.station} · {p.prep_time}min</p>
                  <div className="flex items-end justify-between mt-3">
                    <div>
                      <p className="text-lg font-bold text-emerald-700">{cur(p.price)}</p>
                      <p className="text-xs text-gray-400">cost {cur(cost)} · {margin.toFixed(0)}% margin</p>
                    </div>
                    <div className="flex gap-1">
                      <Btn size="sm" variant="ghost" onClick={() => move(p, -1)}><ArrowUp size={13} /></Btn>
                      <Btn size="sm" variant="ghost" onClick={() => move(p, 1)}><ArrowDown size={13} /></Btn>
                      <Btn size="sm" variant="ghost" onClick={() => { setEditProduct(p); setEditOpen(true) }}><Pencil size={13} /></Btn>
                      <Btn size="sm" variant="ghost" onClick={() => { update((st) => { st.products.find((x) => x.id === p.id).available = !p.available }); toast(p.available ? 'Product archived' : 'Product activated') }}>
                        <Archive size={13} className={p.available ? 'text-gray-400' : 'text-emerald-600'} />
                      </Btn>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {tab === 'categories' && (
        <Card>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-gray-500 border-b border-gray-100">
              <th className="px-4 py-2.5">Name</th><th className="px-4 py-2.5">Sort</th><th className="px-4 py-2.5">Products</th><th className="px-4 py-2.5"></th>
            </tr></thead>
            <tbody>
              {[...s.categories].sort((a, b) => a.sort - b.sort).map((c) => (
                <tr key={c.id} className="border-b border-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-800">{c.name}</td>
                  <td className="px-4 py-2.5">{c.sort}</td>
                  <td className="px-4 py-2.5">{s.products.filter((p) => p.category_id === c.id).length}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Btn size="sm" variant="danger" onClick={() => {
                      if (s.products.some((p) => p.category_id === c.id)) { toast('Category has products — reassign them first', 'error'); return }
                      update((st) => { st.categories = st.categories.filter((x) => x.id !== c.id) }); toast('Category deleted')
                    }}>Delete</Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab === 'modifiers' && (
        <Card title="Modifier groups" actions={<Btn size="sm" onClick={() => setMgOpen(true)}><Plus size={14} /> New group</Btn>}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4">
            {s.modifier_groups.map((g) => (
              <div key={g.id} className="border border-gray-200 rounded-lg p-3">
                <p className="font-medium text-gray-800">{g.name} <span className="text-xs text-gray-400 font-normal">max {g.max}</span></p>
                <div className="mt-2 space-y-1">
                  {g.modifiers.map((m) => (
                    <div key={m.id} className="flex justify-between text-sm text-gray-600">
                      <span>{m.name}</span><span>{m.price ? `+${cur(m.price)}` : 'Free'}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-2">Used by: {Object.entries(s.product_modifiers).filter(([, v]) => v.includes(g.id)).map(([pid]) => s.products.find((p) => p.id === pid)?.name).filter(Boolean).join(', ') || 'none'}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === 'foodcost' && <FoodCostTab />}

      {/* Product editor */}
      <ProductModal open={editOpen} onClose={() => setEditOpen(false)} product={editProduct} onSave={saveProduct} categories={s.categories} />

      <Modal open={catOpen} onClose={() => setCatOpen(false)} title="Add category" width="max-w-sm"
        footer={<><Btn variant="secondary" onClick={() => setCatOpen(false)}>Cancel</Btn><Btn onClick={() => {
          if (!newCat.trim()) return
          update((st) => { st.categories.push({ id: `cat_${Math.random().toString(36).slice(2, 9)}`, name: newCat.trim(), sort: st.categories.length + 1 }) })
          setNewCat(''); setCatOpen(false); toast('Category added')
        }}>Add</Btn></>}>
        <Field label="Category name"><input className={inputCls} value={newCat} onChange={(e) => setNewCat(e.target.value)} /></Field>
      </Modal>

      <Modal open={mgOpen} onClose={() => setMgOpen(false)} title="New modifier group"
        footer={<><Btn variant="secondary" onClick={() => setMgOpen(false)}>Cancel</Btn>
          <Btn onClick={() => {
            if (!mgForm.name.trim()) { toast('Name required', 'error'); return }
            update((st) => {
              st.modifier_groups.push({
                id: `mg_${Math.random().toString(36).slice(2, 9)}`, name: mgForm.name, required: false, min: 0, max: 3,
                modifiers: mgForm.modifiers.filter((m) => m.name).map((m, i) => ({ id: `mod_${Date.now()}_${i}`, name: m.name, price: Number(m.price) || 0 })),
              })
            })
            setMgOpen(false); setMgForm({ name: '', modifiers: [{ name: '', price: '' }] }); toast('Modifier group created')
          }}>Create</Btn></>}>
        <div className="space-y-3">
          <Field label="Group name"><input className={inputCls} value={mgForm.name} onChange={(e) => setMgForm((f) => ({ ...f, name: e.target.value }))} /></Field>
          {mgForm.modifiers.map((m, i) => (
            <div key={i} className="flex gap-2">
              <input className={inputCls} placeholder="Modifier name" value={m.name}
                onChange={(e) => setMgForm((f) => ({ ...f, modifiers: f.modifiers.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) }))} />
              <input className={`${inputCls} w-24`} type="number" step="0.01" placeholder="Price" value={m.price}
                onChange={(e) => setMgForm((f) => ({ ...f, modifiers: f.modifiers.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)) }))} />
            </div>
          ))}
          <Btn size="sm" variant="secondary" onClick={() => setMgForm((f) => ({ ...f, modifiers: [...f.modifiers, { name: '', price: '' }] }))}><Plus size={13} /> Add option</Btn>
        </div>
      </Modal>
    </div>
  )
}

function ProductModal({ open, onClose, product, onSave, categories }) {
  const navigate = useNavigate()
  const s = useRMS()
  const cur = useCurrency()
  const [form, setForm] = useState(null)
  const [recipeRows, setRecipeRows] = useState([])
  useMemo(() => {
    if (!open) return
    setForm(product ? { ...product } : {
      id: null, category_id: categories[0]?.id, name: '', description: '', sku: '', barcode: '',
      price: '', cost: '', emoji: '🍽️', station: 'Main Kitchen', prep_time: 10, tax_rate: 0, available: true,
    })
    setRecipeRows(product ? (s.recipes[product.id] || []).map((r) => ({ ...r })) : [])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!form) return null
  const cost = recipeRows.reduce((sum, r) => {
    const ing = s.ingredients.find((i) => i.id === r.ingredient_id)
    return sum + (ing ? ing.cost_per_unit * r.qty : 0)
  }, 0)
  const price = Number(form.price) || 0
  const margin = price > 0 ? ((price - cost) / price) * 100 : 0

  return (
    <Modal open={open} onClose={onClose} title={form.id ? `Edit ${form.name}` : 'New product'} width="max-w-2xl"
      footer={<>
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn onClick={() => onSave({ ...form, recipe: recipeRows })}>Save product</Btn>
      </>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name"><input className={inputCls} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field>
        <Field label="Category"><Select value={form.category_id} onChange={(v) => setForm((f) => ({ ...f, category_id: v }))} options={categories.map((c) => ({ value: c.id, label: c.name }))} /></Field>
        <Field label="SKU"><input className={inputCls} value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} /></Field>
        <Field label="Barcode"><input className={inputCls} value={form.barcode || ''} onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value }))} /></Field>
        <Field label="Selling price"><input type="number" step="0.01" className={inputCls} value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} /></Field>
        <Field label="Manual cost (0 = use recipe)" hint={`Recipe cost: $${cost.toFixed(2)}`}>
          <input type="number" step="0.01" className={inputCls} value={form.cost} onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))} />
        </Field>
        <Field label="Emoji"><input className={inputCls} value={form.emoji} onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))} /></Field>
        <Field label="Kitchen station"><Select value={form.station} onChange={(v) => setForm((f) => ({ ...f, station: v }))} options={STATIONS.map((x) => ({ value: x, label: x }))} /></Field>
        <Field label="Prep time (min)"><input type="number" className={inputCls} value={form.prep_time} onChange={(e) => setForm((f) => ({ ...f, prep_time: Number(e.target.value) }))} /></Field>
        <Field label="Tax rate %"><input type="number" step="0.1" className={inputCls} value={form.tax_rate} onChange={(e) => setForm((f) => ({ ...f, tax_rate: Number(e.target.value) }))} /></Field>
      </div>
      <Field label="Description"><input className={`${inputCls} mt-3`} value={form.description || ''} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></Field>

      <div className="mt-4 border-t border-gray-100 pt-4">
        <p className="text-sm font-semibold text-gray-800 mb-2">Recipe (ingredients) — auto food cost</p>
        {!!recipeRows.length && (
          <div className="mb-2 hidden grid-cols-[minmax(0,1fr)_8rem_7rem_auto] gap-2 px-2 text-xs font-medium text-gray-500 sm:grid">
            <span>Inventory ingredient</span><span>Amount / product</span><span>Cost</span><span></span>
          </div>
        )}
        {recipeRows.map((r, i) => {
          const ing = s.ingredients.find((x) => x.id === r.ingredient_id)
          return (
            <div key={i} className="mb-2 grid grid-cols-[minmax(0,1fr)_7rem] items-end gap-2 rounded-md border border-gray-100 p-2 sm:grid-cols-[minmax(0,1fr)_8rem_7rem_auto]">
              <Field label="Inventory ingredient">
                <IngredientPicker ingredients={s.ingredients} value={r.ingredient_id}
                  onChange={(v) => setRecipeRows((rows) => rows.map((x, j) => (j === i ? { ...x, ingredient_id: v } : x)))} />
              </Field>
              <Field label="Amount / product">
                <div className="flex items-center gap-1.5">
                  <input type="number" min="0.001" step="0.01" aria-label={`Amount of ${ing?.name || 'ingredient'} used per product`} className={`${inputCls} min-w-0 px-2`} value={r.qty}
                    onChange={(e) => setRecipeRows((rows) => rows.map((x, j) => (j === i ? { ...x, qty: Number(e.target.value) } : x)))} />
                  <span className="shrink-0 text-xs font-medium text-gray-600">{ing?.unit || 'unit'}</span>
                </div>
              </Field>
              <div className="text-xs text-gray-500">
                <span className="mb-1 block font-medium">Cost</span>
                <span className="font-semibold text-gray-800">{ing ? cur(ing.cost_per_unit * r.qty) : '—'}</span>
              </div>
              <Btn size="sm" variant="ghost" aria-label={`Remove ${ing?.name || 'ingredient'} from recipe`} onClick={() => setRecipeRows((rows) => rows.filter((_, j) => j !== i))}>×</Btn>
            </div>
          )
        })}
        <div className="flex flex-wrap items-center gap-3">
          <Btn size="sm" variant="secondary" disabled={!s.ingredients.length}
            onClick={() => setRecipeRows((rows) => [...rows, { ingredient_id: s.ingredients[0].id, qty: 1 }])}>
            <Plus size={13} /> Add ingredient
          </Btn>
          {!s.ingredients.length && (
            <span className="text-xs text-gray-500">
              No inventory ingredients yet.{' '}
              <button type="button" className="font-medium text-emerald-700 hover:underline" onClick={() => { onClose(); navigate('/inventory') }}>
                Add one in Inventory
              </button>
            </span>
          )}
        </div>
        <div className="mt-3 bg-gray-50 rounded-lg p-3 text-sm flex gap-6 flex-wrap">
          <span>Recipe cost: <b>{cur(cost)}</b></span>
          <span>Selling price: <b>{cur(price)}</b></span>
          <span>Gross profit: <b className="text-emerald-600">{cur(price - cost)}</b></span>
          <span>Food cost %: <b className={cost / (price || 1) > 0.35 ? 'text-red-600' : 'text-emerald-600'}>{price ? ((cost / price) * 100).toFixed(1) : 0}%</b></span>
          <span>Margin: <b>{margin.toFixed(1)}%</b></span>
        </div>
      </div>
    </Modal>
  )
}

function IngredientPicker({ ingredients, value, onChange }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const pickerRef = useRef(null)
  const selected = ingredients.find((ingredient) => ingredient.id === value)
  const matches = ingredients.filter((ingredient) =>
    `${ingredient.name} ${ingredient.unit}`.toLowerCase().includes(query.trim().toLowerCase())
  )

  useEffect(() => {
    if (!open) return undefined
    const closeOnOutsideClick = (event) => {
      if (!pickerRef.current?.contains(event.target)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [open])

  return (
    <div className="relative flex-1 min-w-0" ref={pickerRef}>
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          role="combobox"
          aria-label="Search ingredients"
          aria-expanded={open}
          aria-autocomplete="list"
          autoComplete="off"
          className={`${inputCls} pl-9`}
          value={open ? query : selected ? selected.name : ''}
          placeholder={ingredients.length ? 'Search ingredients…' : 'No inventory ingredients'}
          disabled={!ingredients.length}
          onFocus={() => { setOpen(true); setQuery('') }}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') { setOpen(false); setQuery('') }
            if (event.key === 'ArrowDown') pickerRef.current?.querySelector('[role="option"]')?.focus()
          }}
        />
      </div>
      {open && ingredients.length > 0 && (
        <div role="listbox" className="absolute z-[60] mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-xl">
          {matches.length ? matches.map((ingredient) => (
            <button
              key={ingredient.id}
              type="button"
              role="option"
              aria-selected={ingredient.id === value}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-emerald-50 focus:bg-emerald-50 focus:outline-none ${ingredient.id === value ? 'font-semibold text-emerald-700' : 'text-gray-800'}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => { onChange(ingredient.id); setOpen(false); setQuery('') }}
            >
              <span>{ingredient.name}</span>
              <span className="ml-2 text-xs text-gray-500">{ingredient.unit}</span>
            </button>
          )) : (
            <p className="px-3 py-2 text-sm text-gray-500">No ingredients match “{query}”.</p>
          )}
        </div>
      )}
    </div>
  )
}

function FoodCostTab() {
  const s = useRMS()
  const cur = useCurrency()
  const rows = s.products.filter((p) => p.available).map((p) => {
    const cost = productCost(s, p)
    return { ...p, cost, profit: p.price - cost, fcPct: p.price > 0 ? (cost / p.price) * 100 : 0, margin: p.price > 0 ? ((p.price - cost) / p.price) * 100 : 0 }
  }).sort((a, b) => b.fcPct - a.fcPct)

  return (
    <Card title="Theoretical food cost per item (updates automatically when ingredient prices change)">
      <table className="w-full text-sm">
        <thead><tr className="text-left text-xs text-gray-500 border-b border-gray-100">
          <th className="px-4 py-2.5">Product</th><th className="px-4 py-2.5">Price</th><th className="px-4 py-2.5">Recipe cost</th>
          <th className="px-4 py-2.5">Profit / item</th><th className="px-4 py-2.5">Food cost %</th><th className="px-4 py-2.5 w-48">Margin</th>
        </tr></thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-b border-gray-50">
              <td className="px-4 py-2.5 font-medium text-gray-800">{p.emoji} {p.name}</td>
              <td className="px-4 py-2.5">{cur(p.price)}</td>
              <td className="px-4 py-2.5">{cur(p.cost)}</td>
              <td className={`px-4 py-2.5 font-medium ${p.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{cur(p.profit)}</td>
              <td className={`px-4 py-2.5 font-semibold ${p.fcPct > 35 ? 'text-red-600' : p.fcPct > 28 ? 'text-amber-600' : 'text-emerald-600'}`}>{p.fcPct.toFixed(1)}%</td>
              <td className="px-4 py-2.5">
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${p.fcPct > 35 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, p.margin)}%` }} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

// re-export used helper to avoid lint noise
void recipeCost
