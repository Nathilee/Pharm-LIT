import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Badge, Button, Field, Ionicons, Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { api, authedUrl } from '@/lib/api';
import { notify } from '@/lib/dialogs';
import { formatDate, RX_STATUS } from '@/lib/format';
import type { Prescription } from '@/lib/types';

/** Pick a photo (camera or gallery) and upload it as a prescription. */
export function PrescriptionUploader({ onUploaded }: { onUploaded: (p: Prescription) => void }) {
  const [asset, setAsset] = useState<{ uri: string; base64: string; mimeType: string } | null>(null);
  const [doctorName, setDoctorName] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const pick = async (source: 'camera' | 'library') => {
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6, base64: true };
    let result: ImagePicker.ImagePickerResult;
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return notify('Camera permission needed', 'Allow camera access to photograph your prescription.');
      result = await ImagePicker.launchCameraAsync(options);
    } else {
      result = await ImagePicker.launchImageLibraryAsync(options);
    }
    if (result.canceled || !result.assets?.[0]) return;
    const a = result.assets[0];
    let base64 = a.base64 ?? '';
    let mimeType = a.mimeType ?? 'image/jpeg';
    if (!base64 && a.uri.startsWith('data:')) {
      const [head, data] = a.uri.split(',');
      base64 = data;
      mimeType = head.slice(5, head.indexOf(';')) || mimeType;
    }
    if (!base64) return notify('Could not read that image', 'Please try another photo.');
    setAsset({ uri: a.uri, base64, mimeType });
  };

  const upload = async () => {
    if (!asset) return;
    setBusy(true);
    try {
      const { prescription } = await api<{ prescription: Prescription }>('POST', '/api/prescriptions', {
        fileBase64: asset.base64,
        mimeType: asset.mimeType,
        doctorName: doctorName.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setAsset(null);
      setDoctorName('');
      setNotes('');
      onUploaded(prescription);
    } catch (e: any) {
      notify('Upload failed', e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!asset) {
    return (
      <View style={styles.drop}>
        <Ionicons name="document-text-outline" size={32} color={Colors.primary} />
        <T variant="h3" style={{ textAlign: 'center' }}>Upload your prescription</T>
        <T variant="small" style={{ textAlign: 'center' }}>
          Make sure the doctor’s name, date, medicine and signature are clearly visible.
        </T>
        <Row style={{ marginTop: Spacing.sm, flexWrap: 'wrap', justifyContent: 'center' }}>
          {Platform.OS !== 'web' ? (
            <Button title="Take photo" icon="camera" size="sm" onPress={() => pick('camera')} />
          ) : null}
          <Button
            title={Platform.OS === 'web' ? 'Choose image' : 'From gallery'}
            icon="images"
            size="sm"
            variant={Platform.OS === 'web' ? 'primary' : 'outline'}
            onPress={() => pick('library')}
          />
        </Row>
      </View>
    );
  }

  return (
    <View style={{ gap: Spacing.sm }}>
      <Image source={{ uri: asset.uri }} style={styles.preview} contentFit="contain" />
      <Field label="Doctor / hospital (optional)" value={doctorName} onChangeText={setDoctorName} placeholder="e.g. Dr. Owusu, Korle Bu" />
      <Field label="Note for pharmacist (optional)" value={notes} onChangeText={setNotes} placeholder="Anything we should know?" />
      <Row>
        <Button title="Retake" variant="outline" icon="refresh" onPress={() => setAsset(null)} style={{ flex: 1 }} />
        <Button title="Upload" icon="cloud-upload" loading={busy} onPress={upload} style={{ flex: 1 }} />
      </Row>
    </View>
  );
}

export function PrescriptionItem({
  p,
  selected,
  onPress,
}: {
  p: Prescription;
  selected?: boolean;
  onPress?: () => void;
}) {
  const s = RX_STATUS[p.status];
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[styles.item, selected && { borderColor: Colors.primary, backgroundColor: Colors.primarySoft }]}>
      <Image source={{ uri: authedUrl(p.imageUrl) }} style={styles.thumb} contentFit="cover" />
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="h3" style={{ fontSize: 15 }}>Prescription #{p.id}</T>
        <T variant="small">
          {formatDate(p.createdAt)}
          {p.doctorName ? ` · ${p.doctorName}` : ''}
        </T>
        <Badge label={s.label} tone={s.tone} />
        {p.status === 'rejected' && p.reviewNote ? (
          <T variant="small" style={{ color: Colors.danger }}>Reason: {p.reviewNote}</T>
        ) : null}
      </View>
      {onPress ? (
        <Ionicons
          name={selected ? 'radio-button-on' : 'radio-button-off'}
          size={22}
          color={selected ? Colors.primary : Colors.textMuted}
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  drop: {
    alignItems: 'center',
    gap: 6,
    padding: Spacing.xl,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    backgroundColor: Colors.white,
  },
  preview: { width: '100%', height: 260, borderRadius: Radius.md, backgroundColor: '#EEF1F4' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  thumb: { width: 56, height: 56, borderRadius: Radius.sm, backgroundColor: '#EEF1F4' },
});
