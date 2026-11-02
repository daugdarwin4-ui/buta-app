import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Colors } from '../../src/constants/colors';
import { Typography } from '../../src/constants/typography';
import { MIN_TOUCH_TARGET } from '../../src/constants/config';
import { SOSButton } from '../../src/components/emergency/SOSButton';
import { useEmergency } from '../../src/hooks/useEmergency';
import { contactsService } from '../../src/services/emergency/contacts.service';
import { AccessibleButton } from '../../src/components/common/AccessibleButton';
import { ttsService } from '../../src/services/tts/tts.service';
import type { EmergencyContact } from '../../src/types/emergency.types';

export default function EmergencySosScreen() {
  const {
    status,
    countdownSeconds,
    activeEvent,
    error,
    startSOS,
    cancelSOS,
    resolveSOS,
    resetSOS,
    isCountingDown,
    isSending,
    isActive,
  } = useEmergency();

  const [contacts, setContacts] = useState<EmergencyContact[]>([]);

  useEffect(() => {
    ttsService.speak(
      'Emergency SOS screen. Tap the large red SOS button to alert your emergency contacts.',
      'info'
    );
  }, []);

  // Reload on every focus so contacts added on the Contacts screen show up when coming back
  useFocusEffect(
    useCallback(() => {
      contactsService.getContacts().then(setContacts);
    }, [])
  );

  const callNumber = (number: string) => {
    ttsService.speakImmediate(`Calling ${number.split('').join(' ')}.`);
    Linking.openURL(`tel:${number}`).catch(() =>
      ttsService.speak('Could not open the phone dialer.', 'warning')
    );
  };

  const bgColor =isCountingDown || isSending ? '#0F0000' : isActive ? '#0F0000' : '#09090D';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* Header */}
      <View style={styles.header}>
        {!isActive && (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => { resetSOS(); router.back(); }}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.screenTitle} accessibilityRole="header">
          Emergency SOS
        </Text>
        <TouchableOpacity
          style={styles.contactsBtn}
          onPress={() => router.push('/emergency/contacts')}
          accessibilityLabel="Manage emergency contacts"
          accessibilityRole="button"
        >
          <Text style={styles.contactsBtnText}>👥</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* SOS Status banner */}
        {isActive && (
          <View style={styles.activeBanner} accessible accessibilityRole="alert">
            <Text style={styles.activeBannerIcon}>🆘</Text>
            <View>
              <Text style={styles.activeBannerTitle}>SOS Alert Sent!</Text>
              <Text style={styles.activeBannerSub}>
                {activeEvent?.contacts_notified ?? contacts.length} contact
                {(activeEvent?.contacts_notified ?? contacts.length) !== 1 ? 's' : ''} notified
              </Text>
            </View>
          </View>
        )}

        {/* Countdown status message */}
        {isCountingDown && (
          <View style={styles.countdownBanner} accessible accessibilityRole="alert">
            <Text style={styles.countdownBannerText}>
              ⏱ SOS activates in {countdownSeconds}s — Tap Cancel to stop
            </Text>
          </View>
        )}

        {/* Instruction text */}
        {status === 'idle' && (
          <Text style={styles.instruction} accessibilityRole="text">
            Tap the SOS button to alert your emergency contacts with your GPS location via SMS.
          </Text>
        )}

        {/* Error state */}
        {error && (
          <View style={styles.errorBox} accessibilityRole="alert">
            <Text style={styles.errorText}>⚠️ {error}</Text>
            <AccessibleButton
              label="Call 911 Now"
              hint="Opens the phone dialer with 911"
              variant="danger"
              size="lg"
              style={styles.call911Button}
              onPress={() => callNumber('911')}
            />
          </View>
        )}

        {/* SOS Button */}
        <SOSButton
          onPress={isCountingDown ? cancelSOS : startSOS}
          onCancel={cancelSOS}
          isCountingDown={isCountingDown}
          isSending={isSending}
          isActive={isActive}
          countdownSeconds={countdownSeconds}
        />

        {/* Action buttons for active SOS */}
        {isActive && (
          <View style={styles.activeActions}>
            <AccessibleButton
              label="Mark as Resolved"
              hint="Notify contacts that the emergency is over"
              variant="secondary"
              size="lg"
              style={styles.resolveButton}
              onPress={resolveSOS}
            />
          </View>
        )}

        {/* Emergency hotlines */}
        <View style={styles.hotlinesSection}>
          <Text style={styles.hotlinesTitle}>📞 Emergency Hotlines</Text>
          {[
            { name: 'Philippine National Emergency', number: '911' },
            { name: 'PNP Hotline', number: '117' },
            { name: 'Red Cross Philippines', number: '143' },
            { name: 'BFP Fire & Rescue', number: '160' },
          ].map((hotline) => (
            <TouchableOpacity
              key={hotline.number}
              style={styles.hotlineRow}
              onPress={() => callNumber(hotline.number)}
              accessibilityLabel={`Call ${hotline.name}, ${hotline.number.split('').join(' ')}`}
              accessibilityRole="button"
            >
              <View style={styles.hotlineInfo}>
                <Text style={styles.hotlineName}>{hotline.name}</Text>
                <Text style={styles.hotlineNumber}>{hotline.number}</Text>
              </View>
              <Text style={styles.callIcon}>📞</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Contacts quick view */}
        {contacts.length > 0 && (
          <View style={styles.contactsPreview}>
            <Text style={styles.contactsPreviewTitle}>
              Will notify {contacts.length} contact{contacts.length !== 1 ? 's' : ''}:
            </Text>
            {contacts.map((c) => (
              <View key={c.id} style={styles.contactChip}>
                <Text style={styles.contactChipText}>👤 {c.name} — {c.relationship}</Text>
              </View>
            ))}
          </View>
        )}

        {contacts.length === 0 && (
          <View style={styles.noContactsBox}>
            <Text style={styles.noContactsText}>
              ⚠️ No emergency contacts added yet.
            </Text>
            <AccessibleButton
              label="Add Emergency Contacts"
              hint="Navigate to contacts management screen"
              variant="secondary"
              size="md"
              style={styles.addContactsButton}
              onPress={() => router.push('/emergency/contacts')}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: { color: '#FFFFFF', fontSize: 24, fontWeight: '600' },
  screenTitle: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    flex: 1,
    textAlign: 'center',
  },
  contactsBtn: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactsBtnText: { fontSize: 22 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 48,
    alignItems: 'center',
  },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7F1D1D',
    borderRadius: 14,
    padding: 16,
    gap: 12,
    marginBottom: 12,
    width: '100%',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  activeBannerIcon: { fontSize: 32 },
  activeBannerTitle: {
    color: '#FECACA',
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },
  activeBannerSub: {
    color: '#FCA5A5',
    fontSize: Typography.fontSize.sm,
  },
  countdownBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EF4444',
    padding: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 4,
  },
  countdownBannerText: {
    color: '#F87171',
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
  },
  instruction: {
    color: '#9CA3AF',
    fontSize: Typography.fontSize.md,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 8,
    marginTop: 8,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.danger,
    padding: 16,
    width: '100%',
    marginBottom: 12,
  },
  errorText: {
    color: Colors.danger,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: 4,
  },
  call911Button: { width: '100%', borderRadius: 14, marginTop: 8 },
  activeActions: { width: '100%', marginTop: 8 },
  resolveButton: { width: '100%', borderRadius: 16 },
  hotlinesSection: {
    width: '100%',
    backgroundColor: '#111118',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#222230',
    marginTop: 8,
  },
  hotlinesTitle: {
    color: '#E5E7EB',
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: 12,
  },
  hotlineRow: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderColor: '#1F1F2C',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
  },
  hotlineInfo: { flex: 1 },
  callIcon: { fontSize: 24 },
  hotlineName: {
    color: '#D1D5DB',
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  hotlineNumber: {
    color: '#60A5FA',
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.extrabold,
  },
  contactsPreview: {
    width: '100%',
    backgroundColor: '#111118',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#222230',
    marginTop: 14,
    gap: 8,
  },
  contactsPreviewTitle: {
    color: '#9CA3AF',
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    marginBottom: 4,
  },
  contactChip: {
    backgroundColor: '#1A1A26',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#2A2A3A',
  },
  contactChipText: {
    color: '#E5E7EB',
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  noContactsBox: {
    width: '100%',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#D97706',
    marginTop: 14,
    alignItems: 'center',
    gap: 12,
  },
  noContactsText: {
    color: '#FCD34D',
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    textAlign: 'center',
  },
  addContactsButton: { width: '100%', borderRadius: 14 },
});
