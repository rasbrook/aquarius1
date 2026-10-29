import { useMemo, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useNavigate } from 'react-router-dom'
import { useRMS, update, logAudit } from '../lib/rmsData'
import { Badge, Btn, Card, DataTable, Field, inputCls, Modal, PageHeader, Select, Stat, Tabs, toast, useCurrency } from '../components/ui'
import {
    ArrowUpRight, Banknote, CreditCard, Gift, Megaphone, Plus, QrCode, ShieldAlert, Star, Users,
} from 'lucide-react'

const CHANNELS = ['SMS', 'Email']
const AUDIENCES = [
    { value: 'all', label: 'All guests' },
    { value: 'VIP', label: 'VIP guests' },
    { value: 'inactive', label: 'Inactive guests (30+ days)' },
    { value: 'birthday', label: 'Birthdays this month' },
    { value: 'anniversary', label: 'Anniversaries this month' },
]
const TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'loyalty', label: 'Loyalty & CRM' },
    { key: 'campaigns', label: 'Campaigns' },
    { key: 'ordering', label: 'Ordering & upsells' },
    { key: 'reputation', label: 'Reviews & Wi-Fi' },
    { key: 'gifts', label: 'Gift cards' },
    { key: 'promotions', label: 'Promos & ads' },
]

const newCampaign = () => ({ name: '', channel: 'SMS', audience: 'all', message: '', scheduled_at: '' })
const newUpsell = () => ({ trigger_product_id: '', suggested_product_id: '' })
const newGiftCard = () => ({ amount: '', recipient: '', purchaser: '', expires_at: '' })

function campaignAudience(customers, audience, channel) {
    const now = new Date()
    return customers.filter((customer) => {
        const hasConsent = channel === 'SMS' ? Boolean(customer.sms_marketing_consent && customer.phone) : Boolean(customer.email_marketing_consent && customer.email)
        if (!hasConsent) return false
        if (audience === 'VIP') return customer.segment === 'VIP'
        if (audience === 'inactive') return !customer.last_visit || (now - new Date(customer.last_visit)) / 86400000 >= 30
        if (audience === 'birthday') return customer.birthday && new Date(customer.birthday).getMonth() === now.getMonth()
        if (audience === 'anniversary') return customer.anniversary && new Date(customer.anniversary).getMonth() === now.getMonth()
        return true
    }).length
}

function makeCode() {
    return `GIFT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

export default function MarketingPage() {
    const s = useRMS()
    const cur = useCurrency()
    const navigate = useNavigate()
    const [tab, setTab] = useState('overview')
    const [campaignOpen, setCampaignOpen] = useState(false)
    const [campaignForm, setCampaignForm] = useState(newCampaign)
    const [upsellForm, setUpsellForm] = useState(newUpsell)
    const [giftOpen, setGiftOpen] = useState(false)
    const [giftForm, setGiftForm] = useState(newGiftCard)
    const [redeemCard, setRedeemCard] = useState(null)
    const [redeemAmount, setRedeemAmount] = useState('')
    const [feedbackOpen, setFeedbackOpen] = useState(false)
    const [feedbackForm, setFeedbackForm] = useState({ customer_id: '', rating: '5', comments: '' })
    const [requestForm, setRequestForm] = useState({ customer_id: '', channel: 'SMS' })
    const [requestOpen, setRequestOpen] = useState(false)
    const marketing = s.settings.marketing || {}
    const loyalty = s.settings.loyalty
    const cards = s.gift_cards || []
    const campaigns = s.marketing_campaigns || []
    const feedback = s.guest_feedback || []
    const reviewRequests = s.review_requests || []
    const upsellRules = s.upsell_rules || []
    const totalGiftBalance = cards.reduce((sum, card) => sum + Number(card.balance || 0), 0)
    const customerById = (id) => s.customers.find((customer) => customer.id === id)

    const persistMarketing = (change) => update((state) => {
        state.settings.marketing = state.settings.marketing || {}
        change(state.settings.marketing)
    })

    const audienceOptions = (audience) => ({
        total: s.customers.length,
        vip: s.customers.filter((customer) => customer.segment === 'VIP').length,
        inactive: campaignAudience(s.customers, 'inactive'),
        birthday: campaignAudience(s.customers, 'birthday'),
        anniversary: campaignAudience(s.customers, 'anniversary'),
    }[audience] || 0)

    const campaignEstimate = campaignAudience(s.customers, campaignForm.audience, campaignForm.channel)

    const promoMetrics = useMemo(() => s.promotions.map((promo) => {
        const orders = s.orders.filter((order) => order.status === 'completed' && order.discount_code && promo.code && order.discount_code.toLowerCase() === promo.code.toLowerCase())
        const attributedSales = orders.reduce((sum, order) => sum + Number(order.total || 0), 0)
        const discountCost = orders.reduce((sum, order) => sum + Number(order.discount || 0), 0)
        return { ...promo, completedRedemptions: orders.length, attributedSales, discountCost }
    }), [s.promotions, s.orders])

    const saveCampaign = () => {
        if (!campaignForm.name.trim() || !campaignForm.message.trim()) { toast('Enter a campaign name and message', 'error'); return }
        update((state) => {
            state.marketing_campaigns = state.marketing_campaigns || []
            const campaign = {
                ...campaignForm,
                id: `mkt_${Math.random().toString(36).slice(2, 9)}`,
                name: campaignForm.name.trim(),
                status: 'draft',
                estimated_recipients: campaignEstimate,
                created_at: new Date().toISOString(),
            }
            state.marketing_campaigns.unshift(campaign)
            logAudit(state, { user: 'Marketing', action: 'create', entity: 'campaign', entity_id: campaign.name })
        })
        setCampaignOpen(false)
        setCampaignForm(newCampaign())
        toast('Campaign draft saved')
    }

    const saveUpsell = () => {
        if (!upsellForm.trigger_product_id || !upsellForm.suggested_product_id || upsellForm.trigger_product_id === upsellForm.suggested_product_id) {
            toast('Choose two different products', 'error')
            return
        }
        update((state) => {
            state.upsell_rules = state.upsell_rules || []
            const exists = state.upsell_rules.some((rule) => rule.trigger_product_id === upsellForm.trigger_product_id && rule.suggested_product_id === upsellForm.suggested_product_id)
            if (exists) return
            state.upsell_rules.push({ id: `upsell_${Date.now()}`, ...upsellForm, active: true })
        })
        setUpsellForm(newUpsell())
        toast('Upsell suggestion saved')
    }

    const createGiftCard = () => {
        const amount = Number(giftForm.amount)
        if (!amount || amount <= 0) { toast('Enter a valid gift-card amount', 'error'); return }
        update((state) => {
            state.gift_cards = state.gift_cards || []
            state.gift_cards.unshift({
                id: `gift_${Date.now()}`,
                code: makeCode(),
                original_balance: amount,
                balance: amount,
                recipient: giftForm.recipient.trim(),
                purchaser: giftForm.purchaser.trim(),
                created_at: new Date().toISOString(),
                expires_at: giftForm.expires_at,
                redemptions: [],
            })
            logAudit(state, { user: 'Marketing', action: 'issue', entity: 'gift_card', entity_id: state.gift_cards[0].code, new: cur(amount) })
        })
        setGiftOpen(false)
        setGiftForm(newGiftCard())
        toast('Gift card issued')
    }

    const saveRedemption = () => {
        const amount = Number(redeemAmount)
        if (!redeemCard || !amount || amount <= 0 || amount > Number(redeemCard.balance)) { toast('Enter an amount up to the card balance', 'error'); return }
        update((state) => {
            const card = state.gift_cards.find((item) => item.id === redeemCard.id)
            if (!card || amount > Number(card.balance)) return
            card.balance = Math.max(0, Number(card.balance) - amount)
            card.redemptions = card.redemptions || []
            card.redemptions.unshift({ id: `red_${Date.now()}`, amount, date: new Date().toISOString() })
            logAudit(state, { user: 'Staff', action: 'redeem', entity: 'gift_card', entity_id: card.code, prev: cur(Number(card.balance) + amount), new: cur(card.balance) })
        })
        setRedeemCard(null)
        setRedeemAmount('')
        toast('Gift card redeemed')
    }

    const recordFeedback = () => {
        if (!feedbackForm.customer_id || !feedbackForm.comments.trim()) { toast('Select a guest and enter their feedback', 'error'); return }
        const rating = Number(feedbackForm.rating)
        update((state) => {
            state.guest_feedback = state.guest_feedback || []
            state.guest_feedback.unshift({
                id: `feedback_${Date.now()}`,
                customer_id: feedbackForm.customer_id,
                rating,
                comments: feedbackForm.comments.trim(),
                status: rating >= Number(marketing.reviews?.minimum_rating || 4) ? 'positive' : 'manager follow-up',
                created_at: new Date().toISOString(),
            })
        })
        setFeedbackOpen(false)
        setFeedbackForm({ customer_id: '', rating: '5', comments: '' })
        toast(rating >= Number(marketing.reviews?.minimum_rating || 4) ? 'Positive feedback recorded' : 'Feedback flagged for management')
    }

    const queueReviewRequest = () => {
        if (!requestForm.customer_id) { toast('Select a guest', 'error'); return }
        update((state) => {
            state.review_requests = state.review_requests || []
            state.review_requests.unshift({ id: `review_${Date.now()}`, customer_id: requestForm.customer_id, channel: requestForm.channel, status: 'queued', created_at: new Date().toISOString() })
        })
        setRequestOpen(false)
        setRequestForm({ customer_id: '', channel: 'SMS' })
        toast('Review request queued; connect a messaging provider to deliver it')
    }

    const orderingUrl = marketing.direct_ordering?.url || ''
    const defaultOrderingUrl = `${window.location.origin}/order`
    const qrUrl = (tableId) => {
        try {
            const base = orderingUrl.trim() || defaultOrderingUrl
            const url = new URL(base, window.location.origin)
            if (!url.pathname.endsWith('/order')) url.pathname = `${url.pathname.replace(/\/$/, '')}/order`
            if (tableId) url.searchParams.set('table', tableId)
            return url.toString()
        } catch { return '' }
    }

    return (
        <div>
            <PageHeader title="Marketing" subtitle="Guest loyalty, direct sales, campaigns, and reputation" />
            <Tabs active={tab} onChange={setTab} tabs={TABS} />

            {tab === 'overview' && (
                <>
                    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                        <Stat label="Guest profiles" value={s.customers.length} sub={`${s.customers.filter((customer) => customer.segment === 'VIP').length} VIP`} />
                        <Stat label="Active promotions" value={s.promotions.filter((promo) => promo.active).length} sub={`${s.promotions.length} total codes`} />
                        <Stat label="Gift-card balance" value={cur(totalGiftBalance)} sub={`${cards.length} issued`} />
                        <Stat label="Campaign drafts" value={campaigns.filter((campaign) => campaign.status === 'draft').length} sub="Not sent" />
                    </div>
                    <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                        <Card title="Guest retention">
                            <div className="space-y-3">
                                <OverviewLine icon={Users} title="Customer profiles" detail="Visit frequency, spend, dietary needs, and important dates" onClick={() => navigate('/customers')} />
                                <OverviewLine icon={Gift} title="Loyalty & rewards" detail={`${loyalty.points_per_currency} point per ${cur(1)} spent · ${s.settings.marketing?.punch_card?.visits_to_reward || 10} visits per punch reward`} onClick={() => setTab('loyalty')} />
                                <OverviewLine icon={Megaphone} title="Campaign drafts" detail="Birthday, VIP, and win-back audiences" onClick={() => setTab('campaigns')} />
                            </div>
                        </Card>
                        <Card title="Direct growth & reputation">
                            <div className="space-y-3">
                                <OverviewLine icon={QrCode} title="Direct ordering" detail={orderingUrl ? 'Public ordering URL configured' : 'Local QR links ready; set production URL before printing'} onClick={() => setTab('ordering')} />
                                <OverviewLine icon={Star} title="Review management" detail={`${feedback.length} feedback records · ${reviewRequests.length} requests queued`} onClick={() => setTab('reputation')} />
                                <OverviewLine icon={CreditCard} title="Gift cards" detail={`${cards.length} cards · ${cur(totalGiftBalance)} remaining`} onClick={() => setTab('gifts')} />
                            </div>
                        </Card>
                    </div>
                    <Card className="mt-4" title="Provider connections">
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <Connection name="SMS" detail="Provider credentials required" />
                            <Connection name="Email" detail="Sending domain required" />
                            <Connection name="Meta Ads" detail="OAuth connection required" />
                            <Connection name="Google Ads" detail="OAuth connection required" />
                        </div>
                    </Card>
                </>
            )}

            {tab === 'loyalty' && (
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    <Card title="Points & VIP tiers">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <Field label="Points per currency unit"><input type="number" min="0" step="0.1" className={inputCls} value={loyalty.points_per_currency} onChange={(event) => update((state) => { state.settings.loyalty.points_per_currency = Number(event.target.value) })} /></Field>
                            <Field label="Minimum points to redeem"><input type="number" min="0" className={inputCls} value={loyalty.min_redemption} onChange={(event) => update((state) => { state.settings.loyalty.min_redemption = Number(event.target.value) })} /></Field>
                            <Field label="VIP minimum lifetime spend"><input type="number" min="0" className={inputCls} value={loyalty.vip_min_spend || 1000000} onChange={(event) => update((state) => { state.settings.loyalty.vip_min_spend = Number(event.target.value) })} /></Field>
                            <Field label="VIP minimum visits"><input type="number" min="0" className={inputCls} value={loyalty.vip_min_visits || 20} onChange={(event) => update((state) => { state.settings.loyalty.vip_min_visits = Number(event.target.value) })} /></Field>
                        </div>
                        <p className="mt-3 text-xs text-gray-500">Points are awarded to attached customer profiles when POS orders are completed. VIP thresholds are available for targeting; external messages require a connected provider.</p>
                    </Card>
                    <Card title="Digital punch card">
                        <div className="space-y-3">
                            <Field label="Program status"><Select value={String(Boolean(marketing.punch_card?.enabled))} onChange={(value) => persistMarketing((settings) => { settings.punch_card = { ...settings.punch_card, enabled: value === 'true' } })} options={[{ value: 'false', label: 'Off' }, { value: 'true', label: 'On' }]} /></Field>
                            <Field label="Visits to earn reward"><input type="number" min="1" className={inputCls} value={marketing.punch_card?.visits_to_reward || 10} onChange={(event) => persistMarketing((settings) => { settings.punch_card = { ...settings.punch_card, visits_to_reward: Number(event.target.value) } })} /></Field>
                            <Field label="Reward"><input className={inputCls} value={marketing.punch_card?.reward_description || ''} onChange={(event) => persistMarketing((settings) => { settings.punch_card = { ...settings.punch_card, reward_description: event.target.value } })} placeholder="e.g. One free coffee" /></Field>
                            <p className="text-xs text-gray-500">Punch counts use completed POS visits linked to a guest phone/profile. Store staff can identify guests by phone.</p>
                        </div>
                    </Card>
                    <Card title="Guest profile coverage" className="xl:col-span-2">
                        <p className="mb-3 text-sm text-gray-600">Profiles are managed in Customers. They include phone, email, birthday, anniversary, dietary preferences, visit frequency, lifetime spend, points, and order history.</p>
                        <DataTable columns={[
                            { key: 'name', label: 'Guest' },
                            { key: 'phone', label: 'Phone' },
                            { key: 'points', label: 'Points' },
                            { key: 'visits', label: 'Visits' },
                            { key: 'total_spent', label: 'Lifetime spend', render: (customer) => cur(customer.total_spent) },
                            { key: 'segment', label: 'Tier', render: (customer) => <Badge color={customer.segment === 'VIP' ? 'bg-amber-100 text-amber-800' : undefined}>{customer.segment || 'Regular'}</Badge> },
                        ]} rows={s.customers.slice(0, 8)} empty="No guest profiles yet" />
                    </Card>
                </div>
            )}

            {tab === 'campaigns' && (
                <>
                    <PageHeader title="Campaigns" subtitle="Create targeted campaign drafts for birthday, VIP, or win-back guests"
                        actions={<Btn onClick={() => setCampaignOpen(true)}><Plus size={15} /> New campaign</Btn>} />
                    <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <Stat label="All guests" value={audienceOptions('all')} />
                        <Stat label="VIP" value={audienceOptions('vip')} />
                        <Stat label="Inactive 30+ days" value={audienceOptions('inactive')} />
                        <Stat label="Birthdays this month" value={audienceOptions('birthday')} />
                        <Stat label="Anniversaries this month" value={audienceOptions('anniversary')} />
                    </div>
                    <Card pad={false}>
                        <DataTable columns={[
                            { key: 'name', label: 'Campaign', render: (campaign) => <span className="font-medium text-gray-900">{campaign.name}</span> },
                            { key: 'channel', label: 'Channel' },
                            { key: 'audience', label: 'Audience', render: (campaign) => AUDIENCES.find((option) => option.value === campaign.audience)?.label || campaign.audience },
                            { key: 'estimated_recipients', label: 'Est. guests' },
                            { key: 'scheduled_at', label: 'Schedule', render: (campaign) => campaign.scheduled_at ? new Date(campaign.scheduled_at).toLocaleString() : 'Not scheduled' },
                            { key: 'status', label: 'Status', render: (campaign) => <Badge color="bg-amber-100 text-amber-800">Draft</Badge> },
                        ]} rows={campaigns} empty="No campaign drafts yet" />
                    </Card>
                    <p className="mt-3 flex items-start gap-2 text-xs text-gray-500"><ShieldAlert size={14} className="mt-0.5 shrink-0" />Messages are saved as drafts. SMS and email delivery are not activated until a provider is connected.</p>
                </>
            )}

            {tab === 'ordering' && (
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    <Card title="Direct ordering link">
                        <div className="space-y-3">
                            <Field label="Public ordering URL" hint="Use your live guest-facing ordering page URL. Do not use the staff POS link.">
                                <input type="url" className={inputCls} value={orderingUrl} onChange={(event) => persistMarketing((settings) => { settings.direct_ordering = { ...settings.direct_ordering, url: event.target.value } })} placeholder="https://orders.example.com" />
                            </Field>
                            <Field label="Status"><Select value={String(Boolean(marketing.direct_ordering?.enabled))} onChange={(value) => persistMarketing((settings) => { settings.direct_ordering = { ...settings.direct_ordering, enabled: value === 'true' } })} options={[{ value: 'false', label: 'Disabled' }, { value: 'true', label: 'Enabled' }]} /></Field>
                            <p className="text-xs text-amber-700">The QR route is a local ordering preview. This app’s current database only exposes restaurant menus to signed-in owners; guests on other devices need a secure public storefront/API before these codes can accept live orders. Payment provider setup is also required.</p>
                        </div>
                    </Card>
                    <Card title="Table QR codes">
                        {qrUrl('check') ? (
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                {s.tables.slice(0, 12).map((table) => (
                                    <div key={table.id} className="flex flex-col items-center gap-2 rounded-lg border border-gray-200 p-3">
                                        <QRCodeSVG value={qrUrl(table.id)} size={112} level="M" includeMargin />
                                        <p className="text-sm font-medium text-gray-800">Table {table.number}</p>
                                        <a className="text-xs text-emerald-700 hover:underline" href={qrUrl(table.id)} target="_blank" rel="noreferrer">Open link</a>
                                    </div>
                                ))}
                                {!s.tables.length && <p className="col-span-full text-sm text-gray-500">Add tables to generate table-specific QR codes.</p>}
                            </div>
                        ) : <EmptyState icon={QrCode} title="Set a valid public ordering URL" detail="Table QR codes need a valid guest-facing URL." />}
                        {!orderingUrl && <p className="mt-3 text-xs text-amber-700">Codes currently use this app’s address. Configure the public production URL before printing or sharing them.</p>}
                        <p className="mt-2 text-xs text-gray-500">Do not print these QR codes for guest use until a public storefront is connected.</p>
                    </Card>
                    <Card title="Checkout upsells" className="xl:col-span-2">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                            <Field label="When cart contains"><Select value={upsellForm.trigger_product_id} onChange={(value) => setUpsellForm((form) => ({ ...form, trigger_product_id: value }))} options={[{ value: '', label: 'Choose item' }, ...s.products.map((product) => ({ value: product.id, label: product.name }))]} /></Field>
                            <Field label="Suggest"><Select value={upsellForm.suggested_product_id} onChange={(value) => setUpsellForm((form) => ({ ...form, suggested_product_id: value }))} options={[{ value: '', label: 'Choose add-on' }, ...s.products.map((product) => ({ value: product.id, label: product.name }))]} /></Field>
                            <Btn onClick={saveUpsell}><Plus size={14} /> Add suggestion</Btn>
                        </div>
                        <div className="mt-4">
                            <DataTable columns={[
                                { key: 'trigger_product_id', label: 'Cart item', render: (rule) => s.products.find((product) => product.id === rule.trigger_product_id)?.name || 'Unknown item' },
                                { key: 'suggested_product_id', label: 'Suggested add-on', render: (rule) => s.products.find((product) => product.id === rule.suggested_product_id)?.name || 'Unknown item' },
                                { key: 'active', label: 'Status', render: (rule) => <Badge color={rule.active ? 'bg-emerald-100 text-emerald-700' : undefined}>{rule.active ? 'Active' : 'Paused'}</Badge> },
                                { key: 'action', label: '', render: (rule) => <Btn size="sm" variant="secondary" onClick={() => update((state) => { const match = state.upsell_rules.find((item) => item.id === rule.id); if (match) match.active = !match.active })}>{rule.active ? 'Pause' : 'Activate'}</Btn> },
                            ]} rows={upsellRules} empty="No checkout suggestions configured" />
                        </div>
                    </Card>
                </div>
            )}

            {tab === 'reputation' && (
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    <Card title="Review requests" actions={<Btn size="sm" onClick={() => setRequestOpen(true)}><Plus size={14} /> Queue request</Btn>}>
                        <div className="mb-4 grid grid-cols-2 gap-3">
                            <Field label="Automated post-visit requests"><Select value={String(Boolean(marketing.reviews?.enabled))} onChange={(value) => persistMarketing((settings) => { settings.reviews = { ...settings.reviews, enabled: value === 'true' } })} options={[{ value: 'false', label: 'Off' }, { value: 'true', label: 'On' }]} /></Field>
                            <Field label="Request delay (hours)"><input type="number" min="0" className={inputCls} value={marketing.reviews?.delay_hours ?? 2} onChange={(event) => persistMarketing((settings) => { settings.reviews = { ...settings.reviews, delay_hours: Number(event.target.value) } })} /></Field>
                            <Field label="Positive rating threshold"><Select value={String(marketing.reviews?.minimum_rating || 4)} onChange={(value) => persistMarketing((settings) => { settings.reviews = { ...settings.reviews, minimum_rating: Number(value) } })} options={[4, 5].map((rating) => ({ value: String(rating), label: `${rating}+ stars` }))} /></Field>
                        </div>
                        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <Field label="Google review URL"><input type="url" className={inputCls} value={marketing.reviews?.google_url || ''} onChange={(event) => persistMarketing((settings) => { settings.reviews = { ...settings.reviews, google_url: event.target.value } })} placeholder="https://g.page/..." /></Field>
                            <Field label="Yelp review URL"><input type="url" className={inputCls} value={marketing.reviews?.yelp_url || ''} onChange={(event) => persistMarketing((settings) => { settings.reviews = { ...settings.reviews, yelp_url: event.target.value } })} placeholder="https://yelp.com/..." /></Field>
                        </div>
                        <DataTable columns={[
                            { key: 'guest', label: 'Guest', render: (request) => customerById(request.customer_id)?.name || 'Guest' },
                            { key: 'channel', label: 'Channel' },
                            { key: 'created_at', label: 'Queued', render: (request) => new Date(request.created_at).toLocaleDateString() },
                            { key: 'status', label: 'Status', render: () => <Badge color="bg-amber-100 text-amber-800">Awaiting provider</Badge> },
                        ]} rows={reviewRequests.slice(0, 5)} empty="No review requests queued" />
                        <p className="mt-3 text-xs text-gray-500">Positive ratings can link to Google/Yelp; lower ratings are routed to the internal feedback list. Messaging provider required to send requests.</p>
                    </Card>
                    <Card title="Guest Wi-Fi capture">
                        <div className="space-y-3">
                            <Field label="Portal status"><Select value={String(Boolean(marketing.wifi?.enabled))} onChange={(value) => persistMarketing((settings) => { settings.wifi = { ...settings.wifi, enabled: value === 'true' } })} options={[{ value: 'false', label: 'Not active' }, { value: 'true', label: 'Configured' }]} /></Field>
                            <Field label="Captive portal URL"><input type="url" className={inputCls} value={marketing.wifi?.portal_url || ''} onChange={(event) => persistMarketing((settings) => { settings.wifi = { ...settings.wifi, portal_url: event.target.value } })} placeholder="https://wifi.example.com" /></Field>
                            <div className="flex flex-wrap gap-4 text-sm">
                                <label className="flex items-center gap-2"><input type="checkbox" checked={marketing.wifi?.capture_email !== false} onChange={(event) => persistMarketing((settings) => { settings.wifi = { ...settings.wifi, capture_email: event.target.checked } })} /> Capture email</label>
                                <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(marketing.wifi?.capture_phone)} onChange={(event) => persistMarketing((settings) => { settings.wifi = { ...settings.wifi, capture_phone: event.target.checked } })} /> Capture phone</label>
                            </div>
                            <p className="text-xs text-gray-500">Portal settings are saved here; guest Wi-Fi interception and list sync require a compatible access point or captive-portal service.</p>
                        </div>
                    </Card>
                    <Card title="Feedback for management" className="xl:col-span-2" actions={<Btn size="sm" onClick={() => setFeedbackOpen(true)}><Plus size={14} /> Record feedback</Btn>}>
                        <DataTable columns={[
                            { key: 'guest', label: 'Guest', render: (item) => customerById(item.customer_id)?.name || 'Guest' },
                            { key: 'rating', label: 'Rating', render: (item) => <span className="inline-flex items-center gap-1"><Star size={13} className="text-amber-500" />{item.rating}/5</span> },
                            { key: 'comments', label: 'Feedback' },
                            { key: 'created_at', label: 'Received', render: (item) => new Date(item.created_at).toLocaleString() },
                            { key: 'status', label: 'Routing', render: (item) => <Badge color={item.rating >= Number(marketing.reviews?.minimum_rating || 4) ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}>{item.status}</Badge> },
                            {
                                key: 'review_link', label: '', render: (item) => {
                                    const reviewUrl = item.rating >= Number(marketing.reviews?.minimum_rating || 4)
                                        ? marketing.reviews?.google_url || marketing.reviews?.yelp_url
                                        : ''
                                    return reviewUrl ? <a className="text-xs font-medium text-emerald-700 hover:underline" href={reviewUrl} target="_blank" rel="noreferrer">Open review site</a> : '—'
                                }
                            },
                        ]} rows={feedback} empty="No guest feedback recorded" />
                    </Card>
                </div>
            )}

            {tab === 'gifts' && (
                <>
                    <PageHeader title="Gift cards" subtitle="Issue and redeem digital or physical gift-card codes"
                        actions={<Btn onClick={() => setGiftOpen(true)}><Plus size={15} /> Issue gift card</Btn>} />
                    <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                        <Stat label="Cards issued" value={cards.length} />
                        <Stat label="Outstanding balance" value={cur(totalGiftBalance)} />
                        <Stat label="Redeemed" value={cur(cards.reduce((sum, card) => sum + Number(card.original_balance || 0) - Number(card.balance || 0), 0))} />
                    </div>
                    <Card pad={false}>
                        <DataTable columns={[
                            { key: 'code', label: 'Code', render: (card) => <span className="font-mono font-semibold text-gray-900">{card.code}</span> },
                            { key: 'recipient', label: 'Recipient', render: (card) => card.recipient || 'Not specified' },
                            { key: 'original_balance', label: 'Issued', render: (card) => cur(card.original_balance) },
                            { key: 'balance', label: 'Balance', render: (card) => <span className="font-semibold">{cur(card.balance)}</span> },
                            { key: 'expires_at', label: 'Expires', render: (card) => card.expires_at ? new Date(`${card.expires_at}T00:00:00`).toLocaleDateString() : 'No expiry' },
                            { key: 'action', label: '', render: (card) => Number(card.balance) > 0 ? <Btn size="sm" onClick={() => { setRedeemCard(card); setRedeemAmount('') }}><Banknote size={13} /> Redeem</Btn> : <Badge color="bg-gray-100 text-gray-500">Used</Badge> },
                        ]} rows={cards} empty="No gift cards issued" />
                    </Card>
                    <p className="mt-3 text-xs text-gray-500">Codes and balances are tracked locally in this restaurant account. Online purchase, delivery, and POS tender integration require payment-provider setup.</p>
                </>
            )}

            {tab === 'promotions' && (
                <>
                    <PageHeader title="Promotions & ad audiences" subtitle="Track promo code sales and prepare customer segments for retargeting"
                        actions={<Btn variant="secondary" onClick={() => navigate('/promotions')}><ArrowUpRight size={14} /> Manage promotions</Btn>} />
                    <Card pad={false}>
                        <DataTable columns={[
                            { key: 'name', label: 'Promotion' },
                            { key: 'code', label: 'Code', render: (promo) => promo.code || 'No code' },
                            { key: 'times_redeemed', label: 'Completed redemptions', render: (promo) => promo.completedRedemptions },
                            { key: 'attributedSales', label: 'Attributed sales', render: (promo) => cur(promo.attributedSales) },
                            { key: 'discountCost', label: 'Discount cost', render: (promo) => cur(promo.discountCost) },
                            { key: 'efficiency', label: 'Sales / discount', render: (promo) => promo.discountCost ? `${(promo.attributedSales / promo.discountCost).toFixed(1)}x` : '—' },
                        ]} rows={promoMetrics} empty="Create a promotion with a code to start measuring completed redemptions" />
                    </Card>
                    <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                        <Card title="Available ad audiences">
                            <DataTable columns={[
                                { key: 'segment', label: 'Segment' },
                                { key: 'count', label: 'Guests', render: (row) => row.count },
                                { key: 'description', label: 'Use' },
                            ]} rows={[
                                { id: 'vip', segment: 'VIP', count: audienceOptions('vip'), description: 'High-value repeat guests' },
                                { id: 'inactive', segment: 'Win-back', count: audienceOptions('inactive'), description: 'No visit in 30+ days' },
                                { id: 'birthday', segment: 'Birthday', count: audienceOptions('birthday'), description: 'Birthday this month' },
                                { id: 'anniversary', segment: 'Anniversary', count: audienceOptions('anniversary'), description: 'Anniversary this month' },
                            ]} />
                        </Card>
                        <Card title="Audience sync">
                            <div className="space-y-3">
                                <Connection name="Meta / Facebook & Instagram" detail="Not connected" />
                                <Connection name="Google Ads" detail="Not connected" />
                                <p className="text-xs text-gray-500">Audience sync requires OAuth, consent controls, and provider credentials. No guest data is sent until those connections are implemented and authorized.</p>
                            </div>
                        </Card>
                    </div>
                </>
            )}

            <Modal open={campaignOpen} onClose={() => setCampaignOpen(false)} title="New campaign draft" width="max-w-2xl"
                footer={<><Btn variant="secondary" onClick={() => setCampaignOpen(false)}>Cancel</Btn><Btn onClick={saveCampaign}>Save draft</Btn></>}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Campaign name"><input className={inputCls} value={campaignForm.name} onChange={(event) => setCampaignForm((form) => ({ ...form, name: event.target.value }))} placeholder="Birthday treat" /></Field>
                    <Field label="Channel"><Select value={campaignForm.channel} onChange={(value) => setCampaignForm((form) => ({ ...form, channel: value }))} options={CHANNELS.map((channel) => ({ value: channel, label: channel }))} /></Field>
                    <Field label="Audience"><Select value={campaignForm.audience} onChange={(value) => setCampaignForm((form) => ({ ...form, audience: value }))} options={AUDIENCES} /></Field>
                    <Field label="Schedule"><input type="datetime-local" className={inputCls} value={campaignForm.scheduled_at} onChange={(event) => setCampaignForm((form) => ({ ...form, scheduled_at: event.target.value }))} /></Field>
                    <Field label="Message" hint={`${campaignEstimate} opted-in guests match this channel and audience`}>
                        <textarea className={`${inputCls} min-h-28`} value={campaignForm.message} onChange={(event) => setCampaignForm((form) => ({ ...form, message: event.target.value }))} placeholder="Write your offer. Use {name} to personalize." />
                    </Field>
                </div>
            </Modal>

            <Modal open={giftOpen} onClose={() => setGiftOpen(false)} title="Issue gift card"
                footer={<><Btn variant="secondary" onClick={() => setGiftOpen(false)}>Cancel</Btn><Btn onClick={createGiftCard}>Issue card</Btn></>}>
                <div className="space-y-3">
                    <Field label="Amount"><input type="number" min="0.01" step="0.01" className={inputCls} value={giftForm.amount} onChange={(event) => setGiftForm((form) => ({ ...form, amount: event.target.value }))} /></Field>
                    <Field label="Recipient (optional)"><input className={inputCls} value={giftForm.recipient} onChange={(event) => setGiftForm((form) => ({ ...form, recipient: event.target.value }))} /></Field>
                    <Field label="Purchaser (optional)"><input className={inputCls} value={giftForm.purchaser} onChange={(event) => setGiftForm((form) => ({ ...form, purchaser: event.target.value }))} /></Field>
                    <Field label="Expiry date (optional)"><input type="date" className={inputCls} value={giftForm.expires_at} onChange={(event) => setGiftForm((form) => ({ ...form, expires_at: event.target.value }))} /></Field>
                </div>
            </Modal>

            <Modal open={Boolean(redeemCard)} onClose={() => setRedeemCard(null)} title={`Redeem ${redeemCard?.code || 'gift card'}`}
                footer={<><Btn variant="secondary" onClick={() => setRedeemCard(null)}>Cancel</Btn><Btn onClick={saveRedemption}>Redeem</Btn></>}>
                {redeemCard && <div className="space-y-3">
                    <p className="text-sm text-gray-600">Available balance: <strong>{cur(redeemCard.balance)}</strong></p>
                    <Field label="Amount to redeem"><input type="number" min="0.01" max={redeemCard.balance} step="0.01" className={inputCls} value={redeemAmount} onChange={(event) => setRedeemAmount(event.target.value)} /></Field>
                </div>}
            </Modal>

            <Modal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} title="Record guest feedback"
                footer={<><Btn variant="secondary" onClick={() => setFeedbackOpen(false)}>Cancel</Btn><Btn onClick={recordFeedback}>Save feedback</Btn></>}>
                <div className="space-y-3">
                    <Field label="Guest"><Select value={feedbackForm.customer_id} onChange={(value) => setFeedbackForm((form) => ({ ...form, customer_id: value }))} options={[{ value: '', label: 'Choose guest' }, ...s.customers.map((customer) => ({ value: customer.id, label: `${customer.name} · ${customer.phone}` }))]} /></Field>
                    <Field label="Rating"><Select value={feedbackForm.rating} onChange={(value) => setFeedbackForm((form) => ({ ...form, rating: value }))} options={[1, 2, 3, 4, 5].map((rating) => ({ value: String(rating), label: `${rating} stars` }))} /></Field>
                    <Field label="Feedback"><textarea className={`${inputCls} min-h-24`} value={feedbackForm.comments} onChange={(event) => setFeedbackForm((form) => ({ ...form, comments: event.target.value }))} /></Field>
                </div>
            </Modal>

            <Modal open={requestOpen} onClose={() => setRequestOpen(false)} title="Queue review request"
                footer={<><Btn variant="secondary" onClick={() => setRequestOpen(false)}>Cancel</Btn><Btn onClick={queueReviewRequest}>Queue request</Btn></>}>
                <div className="space-y-3">
                    <Field label="Guest"><Select value={requestForm.customer_id} onChange={(value) => setRequestForm((form) => ({ ...form, customer_id: value }))} options={[{ value: '', label: 'Choose guest' }, ...s.customers.map((customer) => ({ value: customer.id, label: `${customer.name} · ${customer.phone}` }))]} /></Field>
                    <Field label="Channel"><Select value={requestForm.channel} onChange={(value) => setRequestForm((form) => ({ ...form, channel: value }))} options={CHANNELS.map((channel) => ({ value: channel, label: channel }))} /></Field>
                    <p className="text-xs text-gray-500">This queues a request record. Connect an SMS/email provider to send it to the guest.</p>
                </div>
            </Modal>
        </div>
    )
}

function OverviewLine({ icon: Icon, title, detail, onClick }) {
    return (
        <button onClick={onClick} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-gray-50">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700"><Icon size={17} /></span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-gray-900">{title}</span><span className="block truncate text-xs text-gray-500">{detail}</span></span>
            <ArrowUpRight size={15} className="shrink-0 text-gray-400" />
        </button>
    )
}

function Connection({ name, detail }) {
    return <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2.5"><span className="text-sm font-medium text-gray-800">{name}</span><Badge color="bg-gray-100 text-gray-600">{detail}</Badge></div>
}

function EmptyState({ icon: Icon, title, detail }) {
    return <div className="flex min-h-48 flex-col items-center justify-center px-4 text-center"><Icon size={28} className="mb-3 text-gray-300" /><p className="text-sm font-medium text-gray-700">{title}</p><p className="mt-1 max-w-xs text-xs text-gray-500">{detail}</p></div>
}