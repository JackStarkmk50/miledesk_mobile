import { useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';

const c = { paper: '#F5F6F0', white: '#FFFFFF', ink: '#203D30', muted: '#65756B', green: '#285B43', sage: '#E6EEDF', line: '#DDE4D9', sand: '#F3E8D6' };
const stages = ['Ready for pickup', 'Picked up', 'On the way', 'Delivered'];
const seed = [
  { id: 'MD-2051', name: 'Kavya', shop: 'Neighbourhood groceries', address: '12, Example Street, Fairlands, Salem', landmark: 'Side entrance, first floor', status: 1, failed: false },
  { id: 'MD-2052', name: 'Arun', shop: 'Local flower shop', address: '8, Sample Road, Alagapuram, Salem', landmark: 'Call from the front gate', status: 0, failed: false },
];
const partner = process.env.EXPO_PUBLIC_APP_ROLE === 'partner';
function Button({ title, onPress, secondary = false, disabled = false }: { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [s.button, secondary && s.secondary, (pressed || disabled) && { opacity: 0.5 }]}><Text style={[s.buttonText, secondary && { color: c.ink }]}>{title}</Text></Pressable>;
}
export default function MobileApp() {
  const [tab, setTab] = useState('Home');
  const [orders, setOrders] = useState(seed);
  const [selected, setSelected] = useState<string | null>(null);
  const [online, setOnline] = useState(false);
  const [address, setAddress] = useState(seed[0].address);
  const [landmark, setLandmark] = useState(seed[0].landmark);
  const [reason, setReason] = useState('');
  const [issue, setIssue] = useState(false);
  const [message, setMessage] = useState('');
  const order = orders.find(item => item.id === selected);
  const active = orders.filter(item => item.status < 3 && !item.failed);
  const tabs = partner ? ['Home', 'Deliveries', 'Account'] : ['Home', 'Orders', 'Address', 'Account'];
  function update(failed = false) {
    if (!order || !online) return;
    setOrders(items => items.map(item => item.id === order.id ? { ...item, status: failed ? item.status : Math.min(3, item.status + 1), failed } : item));
    setMessage(failed ? `Attempt recorded: ${reason.trim()}` : 'Delivery status updated.'); setIssue(false);
  }
  async function navigate() {
    if (!order) return;
    try { await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address)}`); }
    catch { setMessage('Could not open maps. Use the address shown above.'); }
  }
  function card(item: typeof seed[number]) {
    return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.id}`} key={item.id} style={s.card} onPress={() => { setSelected(item.id); setMessage(''); setIssue(false); setReason(''); }}>
      <View style={s.row}><Text style={s.caption}>{item.id}</Text><Text style={s.badge}>{item.failed ? 'Needs dispatcher' : stages[item.status]}</Text></View>
      <Text style={s.cardTitle}>{partner ? item.name : item.shop}</Text><Text style={s.body}>{item.address}</Text><View style={s.divider}/><Text style={s.link}>{partner ? 'View stop details' : 'Follow this delivery'}</Text>
    </Pressable>;
  }
  return <View style={s.screen}><ExpoStatusBar style="dark"/><View style={s.safe}/><View style={s.header}><View style={s.row}><View style={s.mark}><Text style={s.markText}>m</Text></View><Text style={s.brand}>MileDesk{partner ? ' Partner' : ''}</Text></View><Text style={s.caption}>Salem</Text></View>
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled"><Text style={s.caption}>Design preview. Fictional orders. Changes reset on reload.</Text>
      {order ? <>
        <Button title="Back to deliveries" secondary onPress={() => { setSelected(null); setMessage(''); }}/>
        <Text style={s.title}>{partner ? 'Your next handoff.' : 'Your delivery, clearly.'}</Text><Text style={s.body}>{order.id} from {order.shop}</Text>
        <View style={s.banner}><Text style={s.bannerTitle}>{order.failed ? 'Dispatcher review needed' : stages[order.status]}</Text><Text style={s.body}>{order.status === 3 ? 'This sample delivery is complete.' : 'A live arrival estimate is not available in this preview.'}</Text></View>
        <View style={s.section}><Text style={s.heading}>Delivery progress</Text>{stages.map((stage, index) => <View key={stage} style={s.step}><View style={[s.number, index <= order.status && { backgroundColor: c.green }]}><Text style={{ color: index <= order.status ? c.white : c.muted }}>{index + 1}</Text></View><Text style={[s.body, index === order.status && s.strong]}>{stage}</Text></View>)}</View>
        <View style={s.section}><Text style={s.heading}>Find the right entrance</Text><Text style={s.cardTitle}>{order.name}</Text><Text style={s.body}>{order.address}</Text><View style={s.note}><Text style={s.label}>Landmark and access</Text><Text style={s.body}>{order.landmark}</Text></View></View>
        {partner ? <><Button title="Open address in Maps" secondary onPress={navigate}/><Text style={s.caption}>Sample destination. Verify the address before travelling.</Text>{!order.failed && order.status < 3 && <><Button title={['Confirm pickup', 'Start delivery', 'Confirm delivered'][order.status]} disabled={!online} onPress={() => update()}/>{!online && <Text style={s.caption}>Go on shift from Home to update deliveries.</Text>}<Button title="Report delivery issue" secondary disabled={!online} onPress={() => setIssue(true)}/></>}{issue && <View style={s.section}><Text style={s.heading}>What prevented delivery?</Text><TextInput accessibilityLabel="Delivery issue reason" multiline style={s.input} placeholder="Describe the issue for your dispatcher" value={reason} onChangeText={setReason}/><Button title="Record failed attempt" disabled={!reason.trim()} onPress={() => update(true)}/><Button title="Cancel" secondary onPress={() => setIssue(false)}/></View>}</> : <View style={s.note}><Text style={s.label}>Need to change this delivery?</Text><Text style={s.body}>Contact the shop that accepted your order. In-app support is not connected yet.</Text></View>}
      </> : tab === 'Home' ? <>
        <Text style={s.body}>{partner ? 'Your shift, under control.' : 'A little closer to your door.'}</Text><Text style={s.title}>{partner ? 'Ready for\nthe next stop?' : 'Local deliveries.\nLess wondering.'}</Text>
        {partner ? <View style={s.shift}><View style={{ flex: 1, gap: 6 }}><Text style={s.heading}>{online ? 'You’re on shift' : 'You’re off shift'}</Text><Text style={s.body}>Your assigned stops are below.</Text></View><Switch accessibilityLabel="On shift" value={online} onValueChange={setOnline} trackColor={{ false: c.line, true: c.green }}/></View> : <View style={s.banner}><Text style={s.bannerTitle}>Your doorstep matters.</Text><Text style={s.body}>A clear landmark helps your partner find the right entrance.</Text><Button title="Review your address" secondary onPress={() => setTab('Address')}/></View>}
        <View style={s.row}><Text style={s.heading}>{partner ? 'Assigned stops' : 'On its way to you'}</Text><Text style={s.caption}>{active.length} active</Text></View>{active.length ? active.map(card) : <Text style={s.body}>All caught up. No active deliveries.</Text>}
        <View style={s.note}><Text style={s.label}>{partner ? 'Before you head out' : 'From your neighbourhood'}</Text><Text style={s.body}>{partner ? 'Read entrance notes before leaving. Update deliveries only when safely stopped.' : 'Track orders from local businesses. Ordering and payments are not connected in this preview.'}</Text></View>
      </> : tab === 'Orders' || tab === 'Deliveries' ? <><Text style={s.title}>{partner ? 'Your deliveries' : 'Your orders'}</Text><Text style={s.body}>Every handoff, in one place.</Text>{orders.map(card)}</> : tab === 'Address' ? <><Text style={s.title}>Make your door\neasy to find.</Text><Text style={s.body}>Details are saved only for this preview session.</Text><Text style={s.label}>Street address</Text><TextInput accessibilityLabel="Street address" value={address} onChangeText={setAddress} style={s.input} multiline/><Text style={s.label}>Landmark or entrance note</Text><TextInput accessibilityLabel="Landmark or entrance note" value={landmark} onChangeText={setLandmark} style={s.input} multiline/><Button title="Save address" disabled={!address.trim() || !landmark.trim()} onPress={() => { setOrders(items => items.map(item => item.id === seed[0].id ? { ...item, address: address.trim(), landmark: landmark.trim() } : item)); setMessage('Address saved for your sample delivery.'); }}/></> : <><Text style={s.title}>{partner ? 'Partner account' : 'Your account'}</Text><View style={s.banner}><Text style={s.bannerTitle}>Explore MileDesk</Text><Text style={s.body}>Sign-in and shared delivery data are not connected yet.</Text></View><View style={s.section}><Text style={s.label}>Pilot area</Text><Text style={s.cardTitle}>Salem, Tamil Nadu</Text><Text style={s.label}>Location access</Text><Text style={s.body}>This preview does not collect your location.</Text></View><Button title="Reset preview" secondary onPress={() => { setOrders(seed); setOnline(false); setAddress(seed[0].address); setLandmark(seed[0].landmark); setMessage('Preview reset.'); }}/></>}
      {!!message && <Text accessibilityLiveRegion="polite" style={s.notice}>{message}</Text>}
    </ScrollView><View style={s.tabs}>{tabs.map(item => <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: tab === item && !selected }} onPress={() => { setTab(item); setSelected(null); setMessage(''); }} style={[s.tab, tab === item && !selected && { backgroundColor: c.sage }]}><Text style={[s.tabText, tab === item && !selected && s.strong]}>{item}</Text></Pressable>)}</View>
  </View>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.paper }, safe: { height: Platform.OS === 'android' ? StatusBar.currentHeight : 48 }, header: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderColor: c.line }, row: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'space-between' }, mark: { width: 32, height: 32, borderRadius: 10, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center' }, markText: { color: c.white, fontSize: 25, fontWeight: '700' }, brand: { fontSize: 20, fontWeight: '700', color: c.ink },
  content: { padding: 24, gap: 18, width: '100%', maxWidth: 600, alignSelf: 'center', paddingBottom: 40 }, title: { fontSize: 34, fontWeight: '700', color: c.ink, lineHeight: 40, letterSpacing: -1 }, body: { fontSize: 16, lineHeight: 25, color: c.muted }, caption: { fontSize: 12, lineHeight: 18, color: c.muted }, banner: { backgroundColor: c.sage, padding: 24, borderRadius: 22, gap: 12 }, bannerTitle: { color: c.ink, fontSize: 23, fontWeight: '700', lineHeight: 30 }, card: { backgroundColor: c.white, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: c.line, gap: 12 }, cardTitle: { fontSize: 19, color: c.ink, fontWeight: '700' }, badge: { color: c.green, fontSize: 12, flexShrink: 1, textAlign: 'right' }, divider: { height: 1, backgroundColor: c.line }, link: { color: c.green, fontSize: 15, fontWeight: '700' }, heading: { fontSize: 20, fontWeight: '700', color: c.ink }, label: { color: c.ink, fontSize: 14, fontWeight: '700' }, note: { backgroundColor: c.sand, padding: 18, borderRadius: 12, gap: 8 }, shift: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: c.sage, borderRadius: 18, gap: 16 }, section: { paddingVertical: 16, gap: 16, borderBottomWidth: 1, borderColor: c.line }, step: { flexDirection: 'row', gap: 16, alignItems: 'center' }, number: { width: 32, height: 32, borderRadius: 16, backgroundColor: c.line, alignItems: 'center', justifyContent: 'center' }, strong: { color: c.ink, fontWeight: '700' }, button: { backgroundColor: c.green, padding: 16, borderRadius: 12, minHeight: 52, justifyContent: 'center', alignItems: 'center' }, secondary: { backgroundColor: c.sage }, buttonText: { color: c.white, fontSize: 16, fontWeight: '700' }, input: { backgroundColor: c.white, borderColor: c.line, borderWidth: 1, borderRadius: 12, padding: 16, minHeight: 72, color: c.ink, fontSize: 16, textAlignVertical: 'top' }, notice: { padding: 16, backgroundColor: c.sage, color: c.ink, lineHeight: 22 }, tabs: { flexDirection: 'row', padding: 12, paddingBottom: 28, backgroundColor: c.white, borderTopWidth: 1, borderColor: c.line }, tab: { flex: 1, minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, tabText: { fontSize: 13, color: c.muted },
});
