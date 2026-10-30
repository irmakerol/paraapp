import * as ImagePicker from 'expo-image-picker';
import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';
import { base64ToBytes } from './base64';

export interface PreparedImage {
  /** Local preview of the re-encoded image. */
  uri: string;
  bytes: Uint8Array;
  contentType: 'image/jpeg';
}

/**
 * Lets the person choose a photo (library or camera), then shrinks it and re-encodes it as JPEG.
 * Re-encoding drops EXIF data, including the GPS position, as on the website.
 */
export async function pickImage(
  source: 'library' | 'camera',
  maxSide = 1600,
): Promise<PreparedImage | null> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('permission');
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 1,
    exif: false,
  };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;
  const scale = Math.min(1, maxSide / Math.max(asset.width || maxSide, asset.height || maxSide));
  const resized = await manipulateAsync(
    asset.uri,
    scale < 1
      ? [
          {
            resize: {
              width: Math.round(asset.width * scale),
              height: Math.round(asset.height * scale),
            },
          },
        ]
      : [],
    { compress: 0.8, format: SaveFormat.JPEG, base64: true },
  );
  if (!resized.base64) throw new Error('encode');
  return { uri: resized.uri, bytes: base64ToBytes(resized.base64), contentType: 'image/jpeg' };
}
