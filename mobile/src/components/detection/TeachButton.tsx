import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MIN_TOUCH_TARGET } from '../../constants/config';
import { sampleCollector } from '../../services/training/sampleCollector';
import { ttsService } from '../../services/tts/tts.service';

interface TeachButtonProps {
  /** Called with the name the user typed, e.g. to add it to the AI's preferred names */
  onTaught: (name: string) => void;
}

/**
 * "Teach My AI": photograph what the camera sees now and type what the main object is.
 * The picture and name go to the training pictures; a person draws the box on the PC before
 * it is used for training (nothing is retrained automatically).
 */
export function TeachButton({ onTaught }: TeachButtonProps) {
  const [stem, setStem] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const capture = async () => {
    if (busy) return;
    setBusy(true);
    const saved = await sampleCollector.captureNext();
    setBusy(false);
    if (!saved) {
      ttsService.speakImmediate('Could not take the picture. Make sure detection is running.');
      return;
    }
    setName('');
    setStem(saved);
    ttsService.speakImmediate('Picture saved. Type the name of the object.');
  };

  const save = () => {
    const clean = name.trim().toLowerCase();
    if (!stem || !clean) return;
    sampleCollector.setUserLabel(stem, clean);
    onTaught(clean);
    ttsService.speakImmediate(`Saved as ${clean}.`);
    setStem(null);
  };

  const cancel = () => {
    if (stem) sampleCollector.remove(stem);
    setStem(null);
  };

  return (
    <>
      <TouchableOpacity
        style={styles.button}
        onPress={capture}
        accessibilityRole="button"
        accessibilityLabel="Teach my AI"
        accessibilityHint="Takes a picture of what the camera sees, then asks for the object's name"
      >
        <Text style={styles.buttonText}>{busy ? 'Saving…' : '📸 Teach'}</Text>
      </TouchableOpacity>

      <Modal visible={stem !== null} transparent animationType="fade" onRequestClose={cancel}>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={styles.title} accessibilityRole="header">What is this object?</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. rice cooker"
              placeholderTextColor="#9CA3AF"
              autoFocus
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={save}
              accessibilityLabel="Object name"
              maxLength={40}
            />
            <Text style={styles.note}>
              The picture is kept for training. Someone still has to check it and draw the box on the computer.
            </Text>
            <View style={styles.row}>
              <TouchableOpacity style={[styles.action, styles.cancel]} onPress={cancel} accessibilityRole="button">
                <Text style={styles.actionText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.action, styles.save, !name.trim() && styles.disabled]}
                onPress={save}
                disabled={!name.trim()}
                accessibilityRole="button"
                accessibilityState={{ disabled: !name.trim() }}
              >
                <Text style={styles.actionText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(126,34,206,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#111827', borderRadius: 18, padding: 20, gap: 12 },
  title: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  input: {
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#4B5563',
    color: '#FFFFFF',
    fontSize: 18,
    paddingHorizontal: 14,
  },
  note: { color: '#9CA3AF', fontSize: 13, lineHeight: 18 },
  row: { flexDirection: 'row', gap: 10 },
  action: { flex: 1, minHeight: MIN_TOUCH_TARGET, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cancel: { backgroundColor: '#374151' },
  save: { backgroundColor: '#7E22CE' },
  disabled: { opacity: 0.5 },
  actionText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
