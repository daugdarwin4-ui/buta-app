import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Switch,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors } from '../../src/constants/colors';
import { Typography } from '../../src/constants/typography';
import { MIN_TOUCH_TARGET } from '../../src/constants/config';
import { contactsService, normalizePhoneNumber, spellPhoneNumber } from '../../src/services/emergency/contacts.service';
import { AccessibleButton } from '../../src/components/common/AccessibleButton';
import { ttsService } from '../../src/services/tts/tts.service';
import { hapticsService } from '../../src/services/haptics/haptics.service';
import type { EmergencyContact } from '../../src/types/emergency.types';

const RELATIONSHIPS = ['Family', 'Parent', 'Spouse', 'Sibling', 'Friend', 'Caregiver', 'Doctor', 'Other'];

const emptyForm = { name: '', phone_number: '', relationship: 'Family', notify_by_sms: true };

export default function ContactsScreen() {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingContact, setEditingContact] = useState<EmergencyContact | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    loadContacts();
    ttsService.speak('Emergency contacts screen. Manage who gets notified during SOS.', 'info');
  }, []);

  const loadContacts = async () => {
    setLoading(true);
    try {
      const list = await contactsService.getContacts();
      setContacts(list);
    } catch (e) {
      console.warn('Error loading contacts:', e);
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingContact(null);
    setForm(emptyForm);
    setModalVisible(true);
  };

  const openEditModal = (contact: EmergencyContact) => {
    setEditingContact(contact);
    setForm({
      name: contact.name,
      phone_number: contact.phone_number,
      relationship: contact.relationship,
      notify_by_sms: contact.notify_by_sms,
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.phone_number.trim()) {
      ttsService.speak('Please enter both name and phone number.', 'warning');
      Alert.alert('Required Fields', 'Please enter a name and phone number.');
      return;
    }

    const phone = normalizePhoneNumber(form.phone_number);
    if (!phone) {
      const msg =
        'That phone number does not look right. Philippine mobile numbers have 11 digits and start with 0 9.';
      ttsService.speak(msg, 'warning');
      Alert.alert('Check the phone number', msg);
      return;
    }

    setLoading(true);
    try {
      const contact = { ...form, name: form.name.trim(), phone_number: phone };
      // Read the number back digit by digit so a dictation mistake is caught now, not during an SOS
      const readBack = `Number ${spellPhoneNumber(phone)}.`;
      if (editingContact) {
        await contactsService.updateContact(editingContact.id, contact);
        ttsService.speak(`${contact.name} updated. ${readBack}`, 'info');
      } else {
        await contactsService.addContact(contact);
        ttsService.speak(`${contact.name} added as emergency contact. ${readBack}`, 'info');
      }
      await hapticsService.success();
      setModalVisible(false);
      await loadContacts();
    } catch (e) {
      console.warn('Save contact error:', e);
      ttsService.speak('Failed to save contact. Please try again.', 'warning');
    } finally {
      setLoading(false);
    }
  };

  // Confirm first: one accidental tap should not remove someone who gets SOS alerts
  const confirmDelete = (contact: EmergencyContact) => {
    ttsService.speak(`Delete ${contact.name}? Choose Delete or Cancel.`, 'warning');
    Alert.alert(
      `Delete ${contact.name}?`,
      'They will no longer get your SOS alerts.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => ttsService.speak('Kept.', 'info') },
        { text: 'Delete', style: 'destructive', onPress: () => handleDelete(contact) },
      ]
    );
  };

  const handleDelete = async (contact: EmergencyContact) => {
    setLoading(true);
    try {
      await contactsService.deleteContact(contact.id);
      ttsService.speak(`${contact.name} removed.`, 'info');
      await hapticsService.buttonPress();
      await loadContacts();
    } catch (e) {
      console.warn('Delete contact error:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.screenTitle} accessibilityRole="header">Emergency Contacts</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={openAddModal}
          accessibilityLabel="Add new emergency contact"
          accessibilityRole="button"
        >
          <Text style={styles.addBtnText}>＋</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Text style={styles.infoIcon}>📱</Text>
          <Text style={styles.infoText}>
            These contacts will receive an emergency SMS with your live GPS location when you trigger SOS.
          </Text>
        </View>

        {/* Contacts List */}
        {contacts.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyTitle}>No Emergency Contacts</Text>
            <Text style={styles.emptyText}>
              Add at least one trusted contact who should be notified in an emergency.
            </Text>
            <AccessibleButton
              label="Add Contact"
              hint="Add your first emergency contact"
              variant="primary"
              size="lg"
              style={styles.emptyAddButton}
              onPress={openAddModal}
            />
          </View>
        ) : (
          contacts.map((contact) => (
            <View key={contact.id} style={styles.contactCard}>
              <View style={styles.contactAvatar}>
                <Text style={styles.contactAvatarText}>
                  {contact.name.charAt(0).toUpperCase()}
                </Text>
              </View>

              <View style={styles.contactInfo}>
                <Text style={styles.contactName}>{contact.name}</Text>
                <Text style={styles.contactRelationship}>{contact.relationship}</Text>
                <Text style={styles.contactPhone}>{contact.phone_number}</Text>
                {contact.notify_by_sms && (
                  <View style={styles.smsBadge}>
                    <Text style={styles.smsBadgeText}>📱 SMS alerts on</Text>
                  </View>
                )}
              </View>

              <View style={styles.contactActions}>
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => openEditModal(contact)}
                  accessibilityLabel={`Edit ${contact.name}`}
                  accessibilityRole="button"
                >
                  <Text style={styles.editBtnText}>✏️</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => confirmDelete(contact)}
                  accessibilityLabel={`Delete ${contact.name}`}
                  accessibilityRole="button"
                >
                  <Text style={styles.deleteBtnText}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Add / Edit Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.modalContainer} edges={['bottom']}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingContact ? 'Edit Contact' : 'Add Emergency Contact'}
              </Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                accessibilityLabel="Close"
                accessibilityRole="button"
                style={styles.modalCloseBtn}
              >
                <Text style={styles.modalCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {[
                { label: 'Full Name *', key: 'name', placeholder: 'e.g. Maria Santos', keyboard: 'default' as const },
                { label: 'Phone Number *', key: 'phone_number', placeholder: '0917 123 4567', keyboard: 'phone-pad' as const },
              ].map((field) => (
                <View key={field.key} style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>{field.label}</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={form[field.key as keyof typeof form] as string}
                    onChangeText={(val) => setForm((prev) => ({ ...prev, [field.key]: val }))}
                    placeholder={field.placeholder}
                    placeholderTextColor="#6B7280"
                    keyboardType={field.keyboard}
                    autoCapitalize={field.key === 'name' ? 'words' : 'none'}
                    accessibilityLabel={field.label}
                  />
                </View>
              ))}

              {/* Relationship Selector */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Relationship</Text>
                {/* Wrapped rows: every option is visible (a sideways scroller hid the last ones) */}
                <View style={styles.relScroll}>
                  {RELATIONSHIPS.map((rel) => (
                    <TouchableOpacity
                      key={rel}
                      style={[styles.relChip, form.relationship === rel && styles.relChipActive]}
                      onPress={() => setForm((prev) => ({ ...prev, relationship: rel }))}
                      accessibilityLabel={`Relationship: ${rel}`}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: form.relationship === rel }}
                    >
                      <Text style={[styles.relChipText, form.relationship === rel && styles.relChipTextActive]}>
                        {rel}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* SMS Notification Toggle: the whole row is the switch, so it is easy to hit */}
              <TouchableOpacity
                style={styles.switchRow}
                onPress={() => setForm((prev) => ({ ...prev, notify_by_sms: !prev.notify_by_sms }))}
                accessibilityLabel="Text this contact during SOS"
                accessibilityRole="switch"
                accessibilityState={{ checked: form.notify_by_sms }}
                activeOpacity={0.8}
              >
                <View style={styles.switchInfo}>
                  <Text style={styles.switchLabel}>SMS Notifications</Text>
                  <Text style={styles.switchDesc}>Send SMS during SOS alert</Text>
                </View>
                <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                  <Switch
                    value={form.notify_by_sms}
                    trackColor={{ false: Colors.border, true: Colors.danger }}
                    thumbColor={Colors.white}
                  />
                </View>
              </TouchableOpacity>

              <AccessibleButton
                label={editingContact ? 'Save Changes' : 'Add Contact'}
                hint="Save the emergency contact"
                variant="primary"
                size="lg"
                loading={loading}
                style={styles.saveBtn}
                onPress={handleSave}
              />
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },
  backIcon: { color: Colors.textPrimary, fontSize: 24, fontWeight: '600' },
  screenTitle: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    textAlign: 'center',
  },
  addBtn: { width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: Colors.primary, fontSize: 26, fontWeight: 'bold' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    gap: 10,
  },
  infoIcon: { fontSize: 20 },
  infoText: {
    flex: 1,
    color: '#93C5FD',
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
  },
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 14 },
  emptyIcon: { fontSize: 64 },
  emptyTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    textAlign: 'center',
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.md,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 280,
  },
  emptyAddButton: { width: '100%', borderRadius: 16 },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  contactAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactAvatarText: { color: '#FFFFFF', fontSize: 20, fontWeight: Typography.fontWeight.bold },
  contactInfo: { flex: 1, gap: 2 },
  contactName: { color: Colors.textPrimary, fontSize: Typography.fontSize.md, fontWeight: Typography.fontWeight.bold },
  contactRelationship: { color: Colors.textSecondary, fontSize: Typography.fontSize.sm },
  contactPhone: { color: Colors.primary, fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.medium },
  smsBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  smsBadgeText: { color: '#22C55E', fontSize: 11, fontWeight: Typography.fontWeight.medium },
  contactActions: { flexDirection: 'column', gap: 8 },
  editBtn: { width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },
  editBtnText: { fontSize: 20 },
  deleteBtn: { width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },
  deleteBtnText: { fontSize: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContainer: {
    backgroundColor: '#111118',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { color: '#FFFFFF', fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.bold },
  modalCloseBtn: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseBtnText: { color: '#9CA3AF', fontSize: 20, fontWeight: 'bold' },
  fieldGroup: { marginBottom: 18 },
  fieldLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    marginBottom: 8,
  },
  fieldInput: {
    backgroundColor: '#1C1C28',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#2E2E3E',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: Typography.fontSize.md,
    color: '#FFFFFF',
    minHeight: MIN_TOUCH_TARGET,
  },
  relScroll: { marginTop: 4, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  relChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
  },
  relChipActive: { backgroundColor: Colors.danger, borderColor: Colors.danger },
  relChipText: { color: Colors.textSecondary, fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.medium },
  relChipTextActive: { color: '#FFFFFF', fontWeight: Typography.fontWeight.bold },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    minHeight: MIN_TOUCH_TARGET + 8,
  },
  switchInfo: { flex: 1, marginRight: 16 },
  switchLabel: { color: Colors.textPrimary, fontSize: Typography.fontSize.md, fontWeight: Typography.fontWeight.medium },
  switchDesc: { color: Colors.textSecondary, fontSize: Typography.fontSize.xs, marginTop: 2 },
  saveBtn: { width: '100%', borderRadius: 16, marginBottom: 8 },
});
