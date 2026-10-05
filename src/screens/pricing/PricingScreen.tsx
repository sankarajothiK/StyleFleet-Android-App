import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  Alert,
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { Button } from '../../components/common/Button';
import { BackIcon, TrashIcon, EditIcon, PlusIcon, ChatIcon, MoreVerticalIcon } from '../../components/common/SvgIcons';
import { Chip } from '../../components/common/Chip';
import { Service, Offer, ServiceCategory, Customer } from '../../types/domain';
import { inrFromMinor } from '../../utils/format';
import { radii, shadows } from '../../theme/spacing';

const STORAGE_KEY_GEMINI_KEY = '@salon_os_gemini_api_key';

interface PricingScreenProps {
  services: Service[];
  offers: Offer[];
  categories?: ServiceCategory[];
  customers?: Customer[];
  shopId?: string;
  shopName?: string;
  onBack: () => void;
  onAddCategory?: (categoryName: string) => Promise<ServiceCategory>;
  onAddService: (category: string, name: string, priceRupees: number) => Promise<void>;
  onUpdateService?: (serviceId: string, updates: { name?: string; priceRupees?: number; categoryName?: string }) => Promise<void>;
  onRemoveService: (serviceId: string) => Promise<void>;
  onToggleOffer: (offerId: string) => Promise<void>;
  onRemoveOffer: (offerId: string) => Promise<void>;
  onAddOffer: (name: string, description: string, discountType: 'percentage' | 'fixed', discountValue: number) => Promise<void>;
  onImportMenuAI?: (items: { category: string; name: string; priceRupees: number }[]) => Promise<void>;
}

export const PricingScreen = ({
  services,
  offers,
  categories: propCategories = [],
  customers = [],
  shopId = '',
  shopName = 'My Salon',
  onBack,
  onAddCategory,
  onAddService,
  onUpdateService,
  onRemoveService,
  onToggleOffer,
  onRemoveOffer,
  onAddOffer,
  onImportMenuAI,
}: PricingScreenProps) => {
  const { colors } = useTheme();
  const { t } = useLanguage();

  // Add Mode Toggle: 'service' | 'category'
  const [addMode, setAddMode] = useState<'service' | 'category'>('service');
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);

  // Add Service Form
  const [newSvcName, setNewSvcName] = useState('');
  const [newSvcPrice, setNewSvcPrice] = useState('');
  const [selectedCat, setSelectedCat] = useState<string>('Hair');

  // Service Action Menu (Three-dot ⋮)
  const [menuService, setMenuService] = useState<Service | null>(null);

  // Edit Service Modal
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [editSvcName, setEditSvcName] = useState('');
  const [editSvcPrice, setEditSvcPrice] = useState('');
  const [editSvcCat, setEditSvcCat] = useState('');
  const [isEditingSaving, setIsEditingSaving] = useState(false);

  // Bulk Edit Services Mode State
  const [isBulkEditMode, setIsBulkEditMode] = useState(false);
  const [bulkEdits, setBulkEdits] = useState<Record<string, { name: string; priceRupees: string }>>({});
  const [isSavingBulk, setIsSavingBulk] = useState(false);

  const handleEnterBulkEdit = () => {
    const initial: Record<string, { name: string; priceRupees: string }> = {};
    for (const s of services) {
      initial[s.id] = {
        name: s.name,
        priceRupees: String(Math.round(s.price_minor / 100)),
      };
    }
    setBulkEdits(initial);
    setIsBulkEditMode(true);
  };

  const handleBulkChange = (id: string, field: 'name' | 'priceRupees', val: string) => {
    setBulkEdits((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || { name: '', priceRupees: '' }),
        [field]: val,
      },
    }));
  };

  const handleSaveBulkChanges = async () => {
    if (!onUpdateService) return;
    setIsSavingBulk(true);

    const changedServices: { id: string; name: string; priceRupees: number; originalName: string }[] = [];
    for (const s of services) {
      const edit = bulkEdits[s.id];
      if (!edit) continue;
      const originalPrice = Math.round(s.price_minor / 100);
      const newPrice = parseInt(edit.priceRupees, 10);
      const isNameChanged = edit.name.trim() !== s.name.trim();
      const isPriceChanged = !isNaN(newPrice) && newPrice !== originalPrice;

      if (isNameChanged || isPriceChanged) {
        changedServices.push({
          id: s.id,
          name: edit.name.trim() || s.name,
          priceRupees: !isNaN(newPrice) && newPrice >= 0 ? newPrice : originalPrice,
          originalName: s.name,
        });
      }
    }

    if (changedServices.length === 0) {
      setIsBulkEditMode(false);
      setIsSavingBulk(false);
      return;
    }

    const failed: string[] = [];
    for (const item of changedServices) {
      try {
        await onUpdateService(item.id, {
          name: item.name,
          priceRupees: item.priceRupees,
        });
      } catch (err) {
        failed.push(item.originalName);
      }
    }

    setIsSavingBulk(false);
    if (failed.length > 0) {
      Alert.alert(
        'Partial Update',
        `Successfully updated ${changedServices.length - failed.length} services.\n\nFailed to update: ${failed.join(', ')}`
      );
    } else {
      Alert.alert('Saved', `Successfully updated ${changedServices.length} services!`);
    }
    setIsBulkEditMode(false);
  };

  // Add Offer Modal
  const [showAddOfferModal, setShowAddOfferModal] = useState(false);
  const [offerName, setOfferName] = useState('');
  const [offerDesc, setOfferDesc] = useState('');
  const [offerDiscount, setOfferDiscount] = useState('');
  const [offerType, setOfferType] = useState<'percentage' | 'fixed'>('percentage');
  const [isSavingOffer, setIsSavingOffer] = useState(false);

  // AI Menu Import State
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0); // 0 to 100
  const [importStatusText, setImportStatusText] = useState('');

  // Extract unique categories from persisted database categories + services + custom categories + defaults
  const categories = useMemo(() => {
    const fromProps = (propCategories || []).map((c) => c.name);
    return Array.from(
      new Set([
        ...fromProps,
        ...services.map((s) => s.category_name || 'Hair'),
        ...customCategories,
        'Hair',
        'Beard',
        'Colour',
        'Care',
        'Packages',
      ])
    );
  }, [propCategories, services, customCategories]);

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      Alert.alert('Category Name Required', 'Please enter a name for the category');
      return;
    }
    const cleanCat = newCategoryName.trim();
    if (categories.some((c) => c.toLowerCase() === cleanCat.toLowerCase())) {
      Alert.alert('Exists', 'This category already exists');
      return;
    }

    try {
      setIsAddingCategory(true);
      if (onAddCategory) {
        await onAddCategory(cleanCat);
      }
      setCustomCategories((prev) => [...prev, cleanCat]);
      setSelectedCat(cleanCat);
      setNewCategoryName('');
      setAddMode('service');
      Alert.alert('Category Created', `Category "${cleanCat}" has been saved to the database. You can now add services to it!`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not save category to database');
    } finally {
      setIsAddingCategory(false);
    }
  };

  const handleAdd = async () => {
    const price = parseFloat(newSvcPrice);
    if (!newSvcName.trim()) {
      Alert.alert('Service Name Required', 'Please enter a name for the service');
      return;
    }
    if (isNaN(price) || price <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid price in Rupees');
      return;
    }

    try {
      await onAddService(selectedCat, newSvcName.trim(), price);
      setNewSvcName('');
      setNewSvcPrice('');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not add service');
    }
  };

  const handleSaveEdit = async () => {
    if (!editingService || !onUpdateService) return;
    const price = parseFloat(editSvcPrice);
    if (!editSvcName.trim() || isNaN(price) || price <= 0) {
      Alert.alert('Invalid Input', 'Please enter valid service name and price');
      return;
    }

    setIsEditingSaving(true);
    try {
      await onUpdateService(editingService.id, {
        name: editSvcName.trim(),
        priceRupees: price,
        categoryName: editSvcCat,
      });
      setIsEditingSaving(false);
      setEditingService(null);
    } catch (e: any) {
      setIsEditingSaving(false);
      Alert.alert('Error', e.message || 'Failed to update service');
    }
  };

  const handleSaveOffer = async () => {
    if (!offerName.trim()) {
      Alert.alert('Required', 'Please enter offer title');
      return;
    }
    const val = parseFloat(offerDiscount);
    if (isNaN(val) || val <= 0) {
      Alert.alert('Required', 'Please enter discount value');
      return;
    }

    setIsSavingOffer(true);
    try {
      await onAddOffer(offerName.trim(), offerDesc.trim(), offerType, val);
      setIsSavingOffer(false);
      setShowAddOfferModal(false);
      setOfferName('');
      setOfferDesc('');
      setOfferDiscount('');
    } catch (e: any) {
      setIsSavingOffer(false);
      Alert.alert('Error', e.message || 'Could not save offer');
    }
  };

  // AI Menu Import Flow
  const startMenuImport = async () => {
    Alert.alert(
      'Import from Menu',
      'Select a source for your salon menu card:',
      [
        {
          text: 'Camera',
          onPress: () => pickImage(ImagePicker.launchCameraAsync),
        },
        {
          text: 'Photo Gallery',
          onPress: () => pickImage(ImagePicker.launchImageLibraryAsync),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const pickImage = async (launcher: any) => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera / gallery permission is required to import menu.');
        return;
      }

      const result = await launcher({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        processMenuImage(asset.base64 || '', asset.uri);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to select image');
    }
  };

  const promptForGeminiApiKey = async (): Promise<string | null> => {
    return new Promise((resolve) => {
      Alert.prompt(
        'Gemini API Key',
        'Enter a valid Google AI Studio API key to continue with menu import.',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
          { text: 'Save', onPress: (value?: string) => resolve((value || '').trim() || null) },
        ],
        'plain-text',
        ''
      );
    });
  };

  const processMenuImage = async (base64Data: string, fileUri: string) => {
    // 1. Resolve Gemini API key without a bundled fallback that blocks user setup.
    let apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || (await AsyncStorage.getItem(STORAGE_KEY_GEMINI_KEY));

    if (!apiKey) {
      const enteredKey = await promptForGeminiApiKey();
      if (!enteredKey) {
        Alert.alert('Configuration Notice', 'Gemini API key is not configured. Add a valid key to continue.');
        return;
      }
      apiKey = enteredKey;
      await AsyncStorage.setItem(STORAGE_KEY_GEMINI_KEY, apiKey);
    }

    // Prepare Base64 if not already present
    let rawBase64 = base64Data;
    if (!rawBase64 && fileUri) {
      try {
        rawBase64 = await FileSystem.readAsStringAsync(fileUri, {
          encoding: 'base64' as any,
        });
      } catch (err) {
        console.warn('Could not read base64 from uri:', err);
      }
    }

    if (!rawBase64) {
      Alert.alert('Error', 'Could not read image content');
      return;
    }

    setIsImporting(true);
    setImportProgress(20);
    setImportStatusText('Analyzing salon menu with Gemini AI...');

    try {
      // 2. Call Gemini API
      const prompt = `You are an AI assistant that extracts salon service menus into structured JSON.
Look at this salon price list / menu image and extract all service categories, service items, and their prices in Indian Rupees (INR).
Return ONLY a valid JSON object matching this schema:
{
  "items": [
    {
      "category": "Hair",
      "name": "Haircut",
      "price": 350
    }
  ]
}
Do NOT include markdown formatting or backticks. Only output raw JSON.`;

      const requestBody = JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: rawBase64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          response_mime_type: 'application/json',
        },
      });

      // Use x-goog-api-key header with Google Gemini REST API
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      };

      // Try gemini-3.5-flash first, then fallback to gemini-flash-latest
      let response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent`,
        {
          method: 'POST',
          headers,
          body: requestBody,
        }
      );

      if (!response.ok) {
        // Fallback try with gemini-flash-latest
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent`,
          {
            method: 'POST',
            headers,
            body: requestBody,
          }
        );
      }

      setImportProgress(65);
      setImportStatusText('Parsing extracted services & prices...');

      const json = await response.json();
      if (!response.ok) {
        const errorReason = json.error?.details?.[0]?.reason || '';
        if (errorReason === 'API_KEY_SERVICE_BLOCKED') {
          throw new Error(
            'The Generative Language API is blocked or not enabled for this project. In Google AI Studio (aistudio.google.com), click "Create API Key in new project" to generate an unrestricted key.'
          );
        }
        throw new Error(json.error?.message || 'Gemini API request failed');
      }

      const textOutput = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textOutput) {
        throw new Error('No service items identified in the image');
      }

      const parsed = JSON.parse(textOutput);
      const items: { category: string; name: string; price: number }[] = parsed.items || [];

      if (items.length === 0) {
        throw new Error('No recognizable services found in menu image');
      }

      setImportProgress(85);
      setImportStatusText(`Saving ${items.length} services to database...`);

      if (onImportMenuAI) {
        await onImportMenuAI(
          items.map((it) => ({
            category: it.category || 'General',
            name: it.name,
            priceRupees: Number(it.price) || 100,
          }))
        );
      }

      setImportProgress(100);
      setImportStatusText('Done!');
      setTimeout(() => {
        setIsImporting(false);
        setImportProgress(0);
        Alert.alert(
          'Import Successful',
          `Successfully imported ${items.length} services directly into your salon database!`
        );
      }, 600);
    } catch (err: any) {
      setIsImporting(false);
      setImportProgress(0);
      Alert.alert('AI Import Notice', err.message || 'Could not process menu card.');
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      <View style={styles.topBar}>
        <Button variant="icon" onPress={onBack}>
          <BackIcon size={18} color={colors.text} />
        </Button>
        <Text style={[styles.title, { color: colors.text }]}>{t('priceList', 'Price List')}</Text>
        <Text style={[styles.countText, { color: colors.textDim }]}>
          {services.length} {t('services')}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* ======================================================== */}
        {/* 1. COMPACT UPLOAD MENU BUTTON                            */}
        {/* ======================================================== */}
        <View style={styles.compactUploadRow}>
          <TouchableOpacity
            style={[styles.compactUploadButton, { backgroundColor: colors.accent }]}
            onPress={startMenuImport}
            activeOpacity={0.85}
            disabled={isImporting}
          >
            <Text style={{ fontSize: 13, marginRight: 6 }}>✨</Text>
            <Text style={styles.compactUploadButtonText}>{t('importFromMenu', 'Upload Menu')}</Text>
          </TouchableOpacity>
        </View>

        {/* Progress Bar when importing */}
        {isImporting && (
          <View style={[styles.progressCard, { backgroundColor: colors.surface }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ color: colors.text, fontSize: 12 }}>{importStatusText}</Text>
              <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '700' }}>
                {importProgress}%
              </Text>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: colors.trackBg }]}>
              <View style={[styles.progressFill, { width: `${importProgress}%`, backgroundColor: colors.accent }]} />
            </View>
          </View>
        )}

        {/* ======================================================== */}
        {/* 2. SERVICE GROUPS & BULK EDIT                             */}
        {/* ======================================================== */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={[styles.sectionTitle, { color: isBulkEditMode ? colors.accent : colors.text, marginBottom: 0 }]}>
            {isBulkEditMode ? 'BULK EDITING SERVICES' : 'SERVICES CATALOG'}
          </Text>
          {isBulkEditMode ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setIsBulkEditMode(false)}
                disabled={isSavingBulk}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: radii.sm,
                  borderWidth: 1,
                  borderColor: colors.divider,
                }}
              >
                <Text style={{ color: colors.textDim, fontSize: 12, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleSaveBulkChanges}
                disabled={isSavingBulk}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 5,
                  borderRadius: radii.sm,
                  backgroundColor: colors.accent,
                }}
              >
                {isSavingBulk ? (
                  <ActivityIndicator size="small" color="#0D0F14" />
                ) : (
                  <Text style={{ color: '#0D0F14', fontSize: 12, fontWeight: '700' }}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleEnterBulkEdit}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: radii.sm,
                borderWidth: 1,
                borderColor: colors.accent,
                backgroundColor: colors.accent900,
              }}
            >
              <EditIcon size={13} color={colors.accent100} />
              <Text style={{ color: colors.accent100, fontSize: 12, fontWeight: '700' }}>Edit Services</Text>
            </TouchableOpacity>
          )}
        </View>

        {categories.map((cat) => {
          const catServices = services.filter((s) => (s.category_name || 'Hair') === cat);
          if (catServices.length === 0) return null;

          return (
            <View key={cat} style={styles.categoryBlock}>
              <Text style={[styles.categoryHeader, { color: colors.accent }]}>
                {cat.toUpperCase()} ({catServices.length})
              </Text>
              <View style={styles.servicesList}>
                {catServices.map((s) => {
                  if (isBulkEditMode) {
                    return (
                      <View
                        key={s.id}
                        style={{
                          backgroundColor: colors.surface,
                          borderRadius: radii.md,
                          borderWidth: 1,
                          borderColor: colors.divider,
                          padding: 10,
                          marginBottom: 8,
                        }}
                      >
                        <Text style={{ fontSize: 10.5, color: colors.textDim, marginBottom: 3, fontWeight: '600' }}>
                          Service Name
                        </Text>
                        <TextInput
                          value={bulkEdits[s.id]?.name ?? s.name}
                          onChangeText={(val) => handleBulkChange(s.id, 'name', val)}
                          style={{
                            backgroundColor: colors.bg,
                            color: colors.text,
                            borderWidth: 1,
                            borderColor: colors.divider,
                            borderRadius: radii.sm,
                            paddingHorizontal: 8,
                            paddingVertical: 5,
                            fontSize: 12.5,
                            marginBottom: 8,
                          }}
                          placeholder="Service Name"
                          placeholderTextColor={colors.textDim}
                        />
                        <Text style={{ fontSize: 10.5, color: colors.textDim, marginBottom: 3, fontWeight: '600' }}>
                          Price (₹)
                        </Text>
                        <TextInput
                          value={bulkEdits[s.id]?.priceRupees ?? String(Math.round(s.price_minor / 100))}
                          onChangeText={(val) => handleBulkChange(s.id, 'priceRupees', val)}
                          style={{
                            backgroundColor: colors.bg,
                            color: colors.text,
                            borderWidth: 1,
                            borderColor: colors.divider,
                            borderRadius: radii.sm,
                            paddingHorizontal: 8,
                            paddingVertical: 5,
                            fontSize: 12.5,
                          }}
                          placeholder="Price"
                          keyboardType="numeric"
                          placeholderTextColor={colors.textDim}
                        />
                      </View>
                    );
                  }

                  return (
                    <View
                      key={s.id}
                      style={[
                        styles.serviceRow,
                        { borderBottomColor: colors.divider },
                      ]}
                    >
                      <View style={styles.serviceTextGroup}>
                        <Text style={[styles.serviceName, { color: colors.text }]}>
                          {s.name}
                        </Text>
                        <Text style={[styles.servicePrice, { color: colors.textMuted }]}>
                          {inrFromMinor(s.price_minor)}
                        </Text>
                      </View>

                      {/* Vertical Three-dot Menu Button (⋮) */}
                      <TouchableOpacity
                        onPress={() => setMenuService(s)}
                        style={styles.actionIconBtn}
                        activeOpacity={0.7}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel={`Options for ${s.name}`}
                      >
                        <MoreVerticalIcon size={18} color={colors.textDim} />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}

        {isBulkEditMode && (
          <Button
            label={isSavingBulk ? 'Saving Changes...' : 'Save Changes'}
            variant="primary"
            block
            disabled={isSavingBulk}
            onPress={handleSaveBulkChanges}
            style={{ marginBottom: 16 }}
          />
        )}

        {/* ======================================================== */}
        {/* 3. ADD SERVICE / ADD CATEGORY FORM                       */}
        {/* ======================================================== */}
        <View style={[styles.addCard, { backgroundColor: colors.surface }]}>
          {/* Segmented Mode Selector */}
          <View style={{ flexDirection: 'row', backgroundColor: colors.bg, borderRadius: radii.md, padding: 3, marginBottom: 14 }}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setAddMode('service')}
              style={{
                flex: 1,
                paddingVertical: 7,
                alignItems: 'center',
                borderRadius: radii.sm,
                backgroundColor: addMode === 'service' ? colors.accent900 : 'transparent',
                borderWidth: addMode === 'service' ? 1 : 0,
                borderColor: colors.accent,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: addMode === 'service' ? colors.accent100 : colors.textDim }}>
                Add Service
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setAddMode('category')}
              style={{
                flex: 1,
                paddingVertical: 7,
                alignItems: 'center',
                borderRadius: radii.sm,
                backgroundColor: addMode === 'category' ? colors.accent900 : 'transparent',
                borderWidth: addMode === 'category' ? 1 : 0,
                borderColor: colors.accent,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: addMode === 'category' ? colors.accent100 : colors.textDim }}>
                Add Category
              </Text>
            </TouchableOpacity>
          </View>

          {addMode === 'service' ? (
            <>
              <View style={styles.inputRow}>
                <TextInput
                  style={[
                    styles.serviceNameInput,
                    {
                      backgroundColor: colors.bg,
                      borderColor: colors.divider,
                      color: colors.text,
                    },
                  ]}
                  placeholder="Service name (e.g. Beard Trim)"
                  placeholderTextColor={colors.placeholder || colors.textDim}
                  value={newSvcName}
                  onChangeText={setNewSvcName}
                />
                <TextInput
                  style={[
                    styles.servicePriceInput,
                    {
                      backgroundColor: colors.bg,
                      borderColor: colors.divider,
                      color: colors.text,
                    },
                  ]}
                  placeholder="₹ Price"
                  placeholderTextColor={colors.placeholder || colors.textDim}
                  keyboardType="numeric"
                  value={newSvcPrice}
                  onChangeText={setNewSvcPrice}
                />
              </View>

              <Text style={{ fontSize: 11, color: colors.textDim, marginBottom: 6 }}>Category:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {categories.map((cat) => (
                    <Chip
                      key={cat}
                      label={cat}
                      active={selectedCat === cat}
                      onPress={() => setSelectedCat(cat)}
                      size="sm"
                    />
                  ))}
                </View>
              </ScrollView>

              <Button
                label="Add to price list"
                variant="secondary"
                block
                onPress={handleAdd}
              />
            </>
          ) : (
            <>
              <TextInput
                style={[
                  styles.serviceNameInput,
                  {
                    backgroundColor: colors.bg,
                    borderColor: colors.divider,
                    color: colors.text,
                    marginBottom: 12,
                    height: 44,
                  },
                ]}
                placeholder="Category name (e.g. Spa, Facial, Bridal)"
                placeholderTextColor={colors.placeholder || colors.textDim}
                value={newCategoryName}
                onChangeText={setNewCategoryName}
              />
              <Button
                label={isAddingCategory ? 'Saving to Database...' : 'Create Category'}
                variant="secondary"
                block
                disabled={isAddingCategory}
                onPress={handleAddCategory}
              />
            </>
          )}
        </View>

        {/* ======================================================== */}
        {/* 4. OFFERS SECTION WITH FULL CRUD                         */}
        {/* ======================================================== */}
        <View style={{ marginBottom: 8 }}>
          <Text style={[styles.sectionTitle, { color: colors.accent, marginBottom: 0 }]}>DISCOUNT OFFERS</Text>
        </View>

        <View style={styles.offersList}>
          {offers.map((o) => (
            <View
              key={o.id}
              style={[styles.offerCard, { backgroundColor: colors.surface }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.offerName, { color: colors.text }]}>
                  {o.name}
                </Text>
                <Text style={[styles.offerDetail, { color: colors.textDim }]}>
                  {o.description}
                </Text>
              </View>

              {/* Toggle Switch */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => onToggleOffer(o.id)}
                style={[
                  styles.toggleTrack,
                  {
                    backgroundColor: o.is_active ? colors.accent800 : 'transparent',
                    borderColor: o.is_active ? colors.accent : colors.divider,
                  },
                ]}
              >
                <View
                  style={[
                    styles.toggleKnob,
                    {
                      left: o.is_active ? 18 : 2,
                      backgroundColor: o.is_active ? colors.accent200 : colors.textDim,
                    },
                  ]}
                />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => onRemoveOffer(o.id)}
                style={styles.actionIconBtn}
                activeOpacity={0.7}
              >
                <TrashIcon size={16} color={colors.textDim} />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <Button
          label="+ Create offer"
          variant="primary"
          block
          onPress={() => setShowAddOfferModal(true)}
          style={{ marginTop: 12 }}
        />
      </ScrollView>

      {/* ======================================================== */}
      {/* VERTICAL THREE-DOT SERVICE ACTION MENU                   */}
      {/* ======================================================== */}
      <Modal visible={!!menuService} animationType="fade" transparent>
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setMenuService(null)}
        >
          <View
            style={[
              styles.actionMenuCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.divider,
              },
            ]}
          >
            {/* Edit Option */}
            <TouchableOpacity
              style={styles.menuItem}
              activeOpacity={0.7}
              onPress={() => {
                const s = menuService;
                setMenuService(null);
                if (s) {
                  setEditingService(s);
                  setEditSvcName(s.name);
                  setEditSvcPrice(String(Math.round(s.price_minor / 100)));
                  setEditSvcCat(s.category_name || 'Hair');
                }
              }}
            >
              <EditIcon size={16} color={colors.text} />
              <Text style={[styles.menuItemText, { color: colors.text }]}>{t('edit', 'Edit')}</Text>
            </TouchableOpacity>

            {/* Delete Option */}
            <TouchableOpacity
              style={[styles.menuItem, { borderTopWidth: 1, borderTopColor: colors.divider }]}
              activeOpacity={0.7}
              onPress={() => {
                const s = menuService;
                setMenuService(null);
                if (s) {
                  Alert.alert(
                    t('deleteService', 'Delete Service'),
                    `Are you sure you want to remove "${s.name}" from your price list?`,
                    [
                      { text: t('cancel', 'Cancel'), style: 'cancel' },
                      {
                        text: t('delete', 'Delete'),
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            await onRemoveService(s.id);
                          } catch (err: any) {
                            Alert.alert('Error', err?.message || 'Could not delete service');
                          }
                        },
                      },
                    ]
                  );
                }
              }}
            >
              <TrashIcon size={16} color="#EF4444" />
              <Text style={[styles.menuItemText, { color: '#EF4444' }]}>{t('delete', 'Delete')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ======================================================== */}
      {/* EDIT SERVICE MODAL                                       */}
      {/* ======================================================== */}
      <Modal visible={!!editingService} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={() => setEditingService(null)}
            />
            <ScrollView
              contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
              keyboardShouldPersistTaps="handled"
            >
              <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Service</Text>
                  <TouchableOpacity onPress={() => setEditingService(null)}>
                    <Text style={{ color: colors.textDim, fontSize: 16 }}>Cancel</Text>
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.bg, borderColor: colors.divider, color: colors.text }]}
                  placeholder="Service Name"
                  placeholderTextColor={colors.placeholder || colors.textDim}
                  value={editSvcName}
                  onChangeText={setEditSvcName}
                />

                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.bg, borderColor: colors.divider, color: colors.text, marginTop: 10 }]}
                  placeholder="Price in ₹"
                  placeholderTextColor={colors.placeholder || colors.textDim}
                  keyboardType="numeric"
                  value={editSvcPrice}
                  onChangeText={setEditSvcPrice}
                />

                <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textDim, marginTop: 12, marginBottom: 6 }}>
                  MOVE TO CATEGORY
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                  {categories.map((c) => {
                    const isSelected = editSvcCat === c;
                    return (
                      <TouchableOpacity
                        key={c}
                        onPress={() => setEditSvcCat(c)}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: radii.pill,
                          borderWidth: 1,
                          borderColor: isSelected ? colors.accent : colors.divider,
                          backgroundColor: isSelected ? colors.accent900 : colors.bg,
                        }}
                      >
                        <Text style={{ fontSize: 12, color: isSelected ? colors.accent100 : colors.textMuted }}>
                          {c}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleSaveEdit}
                  disabled={isEditingSaving}
                  style={[styles.modalAddBtn, { backgroundColor: colors.accent }]}
                >
                  {isEditingSaving ? (
                    <ActivityIndicator color="#000" size="small" />
                  ) : (
                    <Text style={{ color: '#000', fontWeight: '600', fontSize: 14 }}>Save Changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ======================================================== */}
      {/* ADD OFFER MODAL                                          */}
      {/* ======================================================== */}
      <Modal visible={showAddOfferModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={() => setShowAddOfferModal(false)}
            />
            <ScrollView
              contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
              keyboardShouldPersistTaps="handled"
            >
              <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>Create Promotional Offer</Text>
                  <TouchableOpacity onPress={() => setShowAddOfferModal(false)}>
                    <Text style={{ color: colors.textDim, fontSize: 16 }}>Cancel</Text>
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.bg, borderColor: colors.divider, color: colors.text }]}
                  placeholder="Offer Title (e.g. Festive Spa Discount)"
                  placeholderTextColor={colors.placeholder || colors.textDim}
                  value={offerName}
                  onChangeText={setOfferName}
                />

                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.bg, borderColor: colors.divider, color: colors.text, marginTop: 10 }]}
                  placeholder="Description (e.g. 20% off on all hair care)"
                  placeholderTextColor={colors.placeholder || colors.textDim}
                  value={offerDesc}
                  onChangeText={setOfferDesc}
                />

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                  <TextInput
                    style={[styles.modalInput, { flex: 1, backgroundColor: colors.bg, borderColor: colors.divider, color: colors.text }]}
                    placeholder={offerType === 'percentage' ? 'Discount % (e.g. 15)' : 'Discount ₹ (e.g. 100)'}
                    placeholderTextColor={colors.placeholder || colors.textDim}
                    keyboardType="numeric"
                    value={offerDiscount}
                    onChangeText={setOfferDiscount}
                  />
                  <TouchableOpacity
                    onPress={() => setOfferType(offerType === 'percentage' ? 'fixed' : 'percentage')}
                    style={{
                      height: 44,
                      paddingHorizontal: 12,
                      borderRadius: radii.md,
                      borderWidth: 1,
                      borderColor: colors.divider,
                      backgroundColor: colors.bg,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: colors.accent, fontWeight: '600' }}>
                      {offerType === 'percentage' ? '% Off' : '₹ Flat'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleSaveOffer}
                  disabled={isSavingOffer}
                  style={[styles.modalAddBtn, { backgroundColor: colors.accent, marginTop: 16 }]}
                >
                  {isSavingOffer ? (
                    <ActivityIndicator color="#000" size="small" />
                  ) : (
                    <Text style={{ color: '#000', fontWeight: '600', fontSize: 14 }}>Create Offer</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '500',
  },
  countText: {
    marginLeft: 'auto',
    fontSize: 11.5,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  compactUploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  compactUploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 38,
    paddingHorizontal: 16,
    borderRadius: radii.pill,
    flex: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  compactUploadButtonText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  compactSettingsBtn: {
    width: 38,
    height: 38,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressCard: {
    padding: 12,
    borderRadius: radii.md,
    marginBottom: 16,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  categoryBlock: {
    marginBottom: 14,
  },
  categoryHeader: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 6,
  },
  servicesList: {},
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  serviceTextGroup: {
    flex: 1,
    paddingRight: 12,
  },
  serviceName: {
    fontSize: 14,
    fontWeight: '500',
  },
  servicePrice: {
    fontSize: 13,
    marginTop: 2,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  actionMenuCard: {
    width: 200,
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: 'hidden',
    ...shadows.md,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuItemText: {
    fontSize: 14.5,
    fontWeight: '500',
  },
  actionIconBtn: {
    padding: 8,
  },
  addCard: {
    padding: 12,
    borderRadius: radii.md,
    marginBottom: 16,
  },
  addCardTitle: {
    fontSize: 12.5,
    fontWeight: '500',
    marginBottom: 10,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 9,
  },
  serviceNameInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  servicePriceInput: {
    width: 88,
    height: 40,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  categoriesChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 8,
  },
  offersList: {
    gap: 8,
  },
  offerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: radii.md,
  },
  offerName: {
    fontSize: 13.5,
    fontWeight: '500',
  },
  offerDetail: {
    fontSize: 11.5,
    marginTop: 2,
  },
  toggleTrack: {
    width: 38,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    justifyContent: 'center',
  },
  toggleKnob: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalInput: {
    height: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  modalAddBtn: {
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
