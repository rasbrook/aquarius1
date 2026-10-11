import { useEffect, useState } from 'react'
import { db } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useCurrency } from '../components/ui'
import { Plus, Trash2, CheckCircle2, Circle, StickyNote, Receipt, AlertCircle } from 'lucide-react'
import { format, parseISO, isPast, isToday } from 'date-fns'

export default function NotesBills() {
  const { user } = useAuth()
  const cur = useCurrency()
  const [bills, setBills] = useState([])
  const [notes, setNotes] = useState([])
  const [activeTab, setActiveTab] = useState('bills')
  const [loading, setLoading] = useState(true)

  // Form states
  const [billForm, setBillForm] = useState({ title: '', amount: '', due_date: '', category: 'utilities' })
  const [noteForm, setNoteForm] = useState({ title: '', content: '' })
  const [showBillForm, setShowBillForm] = useState(false)
  const [showNoteForm, setShowNoteForm] = useState(false)

  useEffect(() => {
    if (!user) return
    fetchData()
  }, [user])

  const fetchData = async () => {
    setLoading(true)
    const { data: billsData } = await db('bills')
      .select('*')
      .order('due_date', { ascending: true })
    const { data: notesData } = await db('notes')
      .select('*')
      .order('created_at', { ascending: false })
    setBills(billsData || [])
    setNotes(notesData || [])
    setLoading(false)
  }

  const addBill = async (e) => {
    e.preventDefault()
    if (!billForm.title || !billForm.amount || !billForm.due_date) return
    await db('bills').insert({
      user_id: user.id,
      title: billForm.title,
      amount: parseFloat(billForm.amount),
      due_date: billForm.due_date,
      category: billForm.category,
      status: 'unpaid',
      paid_date: null,
    })
    setBillForm({ title: '', amount: '', due_date: '', category: 'utilities' })
    setShowBillForm(false)
    fetchData()
  }

  const toggleBillStatus = async (bill) => {
    const newStatus = bill.status === 'paid' ? 'unpaid' : 'paid'
    await db('bills')
      .update({ status: newStatus, paid_date: newStatus === 'paid' ? new Date().toISOString().split('T')[0] : null })
      .eq('id', bill.id)
    fetchData()
  }

  const deleteBill = async (id) => {
    if (!confirm('Delete this bill?')) return
    await db('bills').delete().eq('id', id)
    fetchData()
  }

  const addNote = async (e) => {
    e.preventDefault()
    if (!noteForm.title.trim() || !noteForm.content.trim()) return
    await db('notes').insert({
      user_id: user.id,
      title: noteForm.title.trim(),
      content: noteForm.content.trim(),
      pinned: false,
    })
    setNoteForm({ title: '', content: '' })
    setShowNoteForm(false)
    fetchData()
  }

  const deleteNote = async (id) => {
    if (!confirm('Delete this note?')) return
    await db('notes').delete().eq('id', id)
    fetchData()
  }

  const togglePin = async (note) => {
    await db('notes')
      .update({ pinned: !note.pinned })
      .eq('id', note.id)
    fetchData()
  }

  const getDueStatus = (dueDate, status) => {
    if (status === 'paid') return { text: 'Paid', color: 'text-emerald-600 bg-emerald-50' }
    const d = parseISO(dueDate)
    if (isPast(d) && !isToday(d)) return { text: 'Overdue', color: 'text-red-600 bg-red-50' }
    if (isToday(d)) return { text: 'Due Today', color: 'text-amber-600 bg-amber-50' }
    return { text: 'Upcoming', color: 'text-blue-600 bg-blue-50' }
  }

  const unpaidBills = bills.filter((b) => b.status === 'unpaid')
  const totalUnpaid = unpaidBills.reduce((sum, b) => sum + Number(b.amount), 0)
  const overdueCount = unpaidBills.filter((b) => isPast(parseISO(b.due_date)) && !isToday(parseISO(b.due_date))).length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Notes & Bills</h1>
        <p className="text-sm text-gray-500 mt-1">Track bills to pay and keep important notes</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('bills')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'bills'
            ? 'bg-emerald-600 text-white'
            : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
        >
          <Receipt size={16} />
          Bills ({unpaidBills.length} unpaid)
        </button>
        <button
          onClick={() => setActiveTab('notes')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'notes'
            ? 'bg-emerald-600 text-white'
            : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
        >
          <StickyNote size={16} />
          Notes ({notes.length})
        </button>
      </div>

      {/* Bills Tab */}
      {activeTab === 'bills' && (
        <div className="space-y-4">
          {/* Unpaid Bills Summary */}
          {unpaidBills.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <p className="text-xs text-gray-500">Unpaid Bills</p>
                <p className="text-lg font-bold text-gray-900">{unpaidBills.length}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <p className="text-xs text-gray-500">Total Unpaid</p>
                <p className="text-lg font-bold text-red-600">{cur(totalUnpaid)}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <p className="text-xs text-gray-500">Overdue Bills</p>
                <p className="text-lg font-bold text-amber-600">{overdueCount}</p>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={() => setShowBillForm(!showBillForm)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700"
            >
              <Plus size={16} />
              {showBillForm ? 'Cancel' : 'Add Bill'}
            </button>
          </div>

          {showBillForm && (
            <form onSubmit={addBill} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <input
                  type="text"
                  placeholder="Bill title"
                  value={billForm.title}
                  onChange={(e) => setBillForm({ ...billForm, title: e.target.value })}
                  required
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Amount"
                  value={billForm.amount}
                  onChange={(e) => setBillForm({ ...billForm, amount: e.target.value })}
                  required
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <input
                  type="date"
                  value={billForm.due_date}
                  onChange={(e) => setBillForm({ ...billForm, due_date: e.target.value })}
                  required
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <select
                  value={billForm.category}
                  onChange={(e) => setBillForm({ ...billForm, category: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="utilities">Utilities</option>
                  <option value="food_cost">Food Cost</option>
                  <option value="rent">Rent</option>
                  <option value="salaries">Salaries</option>
                  <option value="marketing">Marketing</option>
                  <option value="miscellaneous">Miscellaneous</option>
                </select>
              </div>
              <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">
                Save Bill
              </button>
            </form>
          )}

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {bills.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-400">
                <Receipt size={32} className="mx-auto mb-3 text-gray-300" />
                <p>No bills recorded yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {bills.map((bill) => {
                  const status = getDueStatus(bill.due_date, bill.status)
                  return (
                    <div key={bill.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleBillStatus(bill)}
                          className={bill.status === 'paid' ? 'text-emerald-500' : 'text-gray-300 hover:text-emerald-500'}
                        >
                          {bill.status === 'paid' ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                        </button>
                        <div>
                          <p className={`text-sm font-medium ${bill.status === 'paid' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                            {bill.title}
                          </p>
                          <p className="text-xs text-gray-500">
                            Due {format(parseISO(bill.due_date), 'MMM d, yyyy')}
                            {bill.paid_date && ` · Paid ${format(parseISO(bill.paid_date), 'MMM d, yyyy')}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                          {status.text}
                        </span>
                        <p className={`text-sm font-semibold ${bill.status === 'paid' ? 'text-gray-400' : 'text-gray-900'}`}>
                          {cur(bill.amount)}
                        </p>
                        <button onClick={() => deleteBill(bill.id)} className="text-gray-300 hover:text-red-500">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notes Tab */}
      {activeTab === 'notes' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowNoteForm(!showNoteForm)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700"
            >
              <Plus size={16} />
              {showNoteForm ? 'Cancel' : 'Add Note'}
            </button>
          </div>

          {showNoteForm && (
            <form onSubmit={addNote} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-3">
              <input
                type="text"
                placeholder="Note title"
                value={noteForm.title}
                onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <textarea
                placeholder="Write your note here..."
                value={noteForm.content}
                onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })}
                required
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              />
              <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">
                Save Note
              </button>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {notes.length === 0 ? (
              <div className="md:col-span-2 bg-white rounded-xl border border-gray-200 px-6 py-12 text-center text-gray-400">
                <StickyNote size={32} className="mx-auto mb-3 text-gray-300" />
                <p>No notes yet.</p>
              </div>
            ) : (
              notes.map((note) => (
                <div key={note.id} className={`bg-white rounded-xl border ${note.pinned ? 'border-amber-200' : 'border-gray-200'} p-5 shadow-sm`}>
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-sm font-semibold text-gray-900">{note.title}</h3>
                    <div className="flex items-center gap-1">
                      {note.pinned && <AlertCircle size={14} className="text-amber-500" />}
                      <button onClick={() => togglePin(note)} className="text-gray-300 hover:text-amber-500" title="Pin/unpin">
                        <AlertCircle size={14} />
                      </button>
                      <button onClick={() => deleteNote(note.id)} className="text-gray-300 hover:text-red-500">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{note.content}</p>
                  <p className="text-xs text-gray-400 mt-3">
                    {format(parseISO(note.created_at), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
