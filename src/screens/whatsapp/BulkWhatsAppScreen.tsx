import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Linking,
  Alert,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { Button } from '../../components/common/Button';
import {
  BackIcon,
  SearchIcon,
  CheckIcon,
  CrossIcon,
  WhatsAppIcon,
  ChevronDownIcon,
} from '../../components/common/SvgIcons';
import { Chip } from '../../components/common/Chip';
import {
  WHATSAPP_TEMPLATES,
  FESTIVAL_OFFER_TEMPLATES,
  FestivalOfferTemplate,
  WhatsAppAudience,
  whatsappRepository,
} from '../../repositories/whatsappRepository';
import { Customer } from '../../types/domain';
import { radii } from '../../theme/spacing';

interface BulkWhatsAppScreenProps {
  shopName: string;
  customers?: Customer[];
  onBack: () => void;
  onSendBulk: (params: { audience: WhatsAppAudience; message: string }) => void;
}

const getTemplateEmoji = (id: string): string => {
  switch (id) {
    case 'diwali':
      return '🪔';
    case 'pongal':
      return '🌾';
    case 'new_year':
      return '🎉';
    case 'christmas':
      return '🎄';
    case 'festival_general':
      return '🌟';
    case 'birthday':
      return '🎂';
    case 'anniversary':
      return '🥂';
    case 'weekend':
      return '⚡';
    case 'special':
      return '👑';
    default:
      return '🏷️';
  }
};

const getStandardEmoji = (key: string): string => {
  const lower = key.toLowerCase();
  if (lower.includes('diwali')) return '🪔';
  if (lower.includes('pongal')) return '🌾';
  if (lower.includes('new year')) return '🎉';
  if (lower.includes('christmas')) return '🎄';
  if (lower.includes('birthday')) return '🎂';
  if (lower.includes('weekend')) return '⚡';
  if (lower.includes('miss') || lower.includes('recall')) return '👋';
  if (lower.includes('vip') || lower.includes('mvp')) return '💎';
  if (lower.includes('due')) return '💳';
  return '✨';
};

export const BulkWhatsAppScreen = ({
  shopName,
  customers = [],
  onBack,
  onSendBulk,
}: BulkWhatsAppScreenProps) => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { width: screenWidth } = useWindowDimensions();

  // 1. TEMPLATE SELECTION
  const festivalTemplates = FESTIVAL_OFFER_TEMPLATES;
  const standardTemplateKeys = Object.keys(WHATSAPP_TEMPLATES);

  const [selectedTemplateType, setSelectedTemplateType] = useState<'festival' | 'standard'>('festival');
  const [selectedFestivalId, setSelectedFestivalId] = useState<string>('diwali');
  const [selectedStandardKey, setSelectedStandardKey] = useState<string>(standardTemplateKeys[0] || 'Monthly offer');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // 2. CREATE / EDIT OFFER FIELDS
  const [offerTitle, setOfferTitle] = useState('Diwali Festive Sparkle');
  const [offerDiscount, setOfferDiscount] = useState('Flat 20% OFF');
  const [offerValidity, setOfferValidity] = useState('Valid till Diwali night');
  const [message, setMessage] = useState(
    FESTIVAL_OFFER_TEMPLATES[0]?.templateBody || ''
  );

  // Sync template change into editable fields
  const handleSelectFestivalTemplate = (tmpl: FestivalOfferTemplate) => {
    setSelectedFestivalId(tmpl.id);
    setOfferTitle(tmpl.title);
    setOfferDiscount(tmpl.defaultOffer);
    setOfferValidity(tmpl.defaultValidity);
    setMessage(tmpl.templateBody);
    setIsDropdownOpen(false);
  };

  const handleSelectStandardTemplate = (key: string) => {
    setSelectedStandardKey(key);
    setOfferTitle(key);
    setOfferDiscount('Exclusive Special');
    setOfferValidity('Valid this month');
    setMessage(WHATSAPP_TEMPLATES[key] || '');
    setIsDropdownOpen(false);
  };

  const handleSelectCustomOffer = () => {
    setSelectedFestivalId('custom_new');
    setSelectedStandardKey('custom_new');
    setOfferTitle('Special Salon Offer');
    setOfferDiscount('Flat 20% OFF');
    setOfferValidity('Valid this week');
    setMessage(`Hello [name]! Enjoy [offer] on all grooming & hair services at [shop]. [validity]. Reply to book your appointment!`);
    setIsDropdownOpen(false);
  };

  // 3. AUDIENCE & CUSTOMER SELECTION
  const [audienceFilter, setAudienceFilter] = useState<'all' | 'mvp' | 'dues' | 'inactive'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());
  const [sentCustomerIds, setSentCustomerIds] = useState<Set<string>>(new Set());

  // Filtered customer roster
  const filteredCustomers = useMemo(() => {
    let list = customers || [];

    if (audienceFilter === 'mvp') {
      list = list.filter((c) => c.is_starred);
    } else if (audienceFilter === 'dues') {
      list = list.filter((c) => (c.outstanding_due_minor || 0) > 0);
    } else if (audienceFilter === 'inactive') {
      const nowMs = Date.now();
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      list = list.filter((c) => {
        if (!c.last_visit_date) return false;
        const v = new Date(c.last_visit_date).getTime();
        return !isNaN(v) && nowMs - v > thirtyDaysMs;
      });
    }

    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.phone || '').includes(q)
    );
  }, [customers, audienceFilter, searchQuery]);

  const [displayLimit, setDisplayLimit] = useState(50);

  // Reset selection & display limit on filter or query change so users can easily select 1 or 2 customers
  useEffect(() => {
    setSelectedCustomerIds(new Set());
    setDisplayLimit(50);
  }, [audienceFilter]);

  useEffect(() => {
    setDisplayLimit(50);
  }, [searchQuery]);

  const toggleSelectCustomer = useCallback((id: string) => {
    setSelectedCustomerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedCustomerIds((prev) => {
      if (prev.size === filteredCustomers.length && filteredCustomers.length > 0) {
        return new Set();
      } else {
        return new Set(filteredCustomers.map((c) => c.id));
      }
    });
  }, [filteredCustomers]);

  // Tag insertion helper
  const handleInsertTag = (tag: string) => {
    setMessage((prev) => `${prev} ${tag}`);
  };

  // 4. PREVIEW CALCULATION
  const firstSelectedCustomer = customers.find((c) => selectedCustomerIds.has(c.id)) || customers[0];
  const sampleCustomerName = firstSelectedCustomer ? firstSelectedCustomer.name : 'Valued Client';

  const previewText = whatsappRepository.renderPreview(
    message,
    sampleCustomerName,
    shopName,
    offerDiscount,
    offerValidity
  );

  // 5. DIRECT FAST WHATSAPP CHAT DISPATCH (Zero delay - native intent protocol first)
  const handleSendSingleWhatsApp = useCallback(
    async (customer: Customer) => {
      const cleanPhone = (customer.phone || '').replace(/\D/g, '').slice(-10);
      if (!cleanPhone || cleanPhone.length < 10) {
        Alert.alert('Invalid Number', `Customer ${customer.name} does not have a valid 10-digit mobile number.`);
        return;
      }

      const personalized = whatsappRepository.renderPreview(
        message,
        customer.name,
        shopName,
        offerDiscount,
        offerValidity
      );

      const encodedMsg = encodeURIComponent(personalized);
      const waUrl = `whatsapp://send?phone=91${cleanPhone}&text=${encodedMsg}`;

      try {
        // Native WhatsApp Intent: Launches WhatsApp instantly in ~50ms directly into the chat!
        await Linking.openURL(waUrl);
        setSentCustomerIds((prev) => new Set([...prev, customer.id]));
      } catch {
        // Web fallback only if native WhatsApp protocol is not available
        try {
          const webUrl = `https://wa.me/91${cleanPhone}?text=${encodedMsg}`;
          await Linking.openURL(webUrl);
          setSentCustomerIds((prev) => new Set([...prev, customer.id]));
        } catch {
          Alert.alert('Error', 'Unable to launch WhatsApp application on this device.');
        }
      }
    },
    [message, shopName, offerDiscount, offerValidity]
  );

  // 6. SEND TO TARGET CUSTOMERS HANDLER
  const handleSendToTargetCustomers = async () => {
    const unSentSelected = filteredCustomers.filter(
      (c) => selectedCustomerIds.has(c.id) && !sentCustomerIds.has(c.id)
    );
    const targetList = unSentSelected.length > 0
      ? unSentSelected
      : filteredCustomers.filter((c) => selectedCustomerIds.has(c.id));

    if (targetList.length === 0) {
      Alert.alert('No Customers Selected', 'Please select at least one customer to send this offer.');
      return;
    }

    // Open first target customer's WhatsApp chat directly!
    const nextCust = targetList[0];
    await handleSendSingleWhatsApp(nextCust);
  };

  const selectedCount = selectedCustomerIds.size;
  const sentCount = filteredCustomers.filter((c) => selectedCustomerIds.has(c.id) && sentCustomerIds.has(c.id)).length;
  const remainingCount = Math.max(0, selectedCount - sentCount);
  const sendMinutes = Math.max(1, Math.round(selectedCount / 40));

  const isSmallScreen = screenWidth < 360;

  // Find currently active item label
  const currentFestivalItem = festivalTemplates.find((t) => t.id === selectedFestivalId);
  const activeTemplateLabel = selectedTemplateType === 'festival'
    ? (selectedFestivalId === 'custom_new' ? '➕ Custom / Create Your Own Offer' : `${getTemplateEmoji(selectedFestivalId)} ${currentFestivalItem?.title || offerTitle}`)
    : (selectedStandardKey === 'custom_new' ? '➕ Custom / Create Your Own Offer' : `${getStandardEmoji(selectedStandardKey)} ${selectedStandardKey}`);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.topBar, { borderBottomColor: colors.divider }]}>
        <Button variant="icon" onPress={onBack}>
          <BackIcon size={18} color={colors.text} />
        </Button>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={[styles.title, { color: colors.text }]}>
            {t('whatsAppOffersAndAds', 'WhatsApp Offers & Ads')}
          </Text>
          <Text numberOfLines={1} style={[styles.headerSubtitle, { color: colors.textDim }]}>
            Targeted promotions, festival campaigns & instant ads
          </Text>
        </View>
        <View style={[styles.headerWhatsAppBadge, { backgroundColor: 'rgba(37, 211, 102, 0.12)' }]}>
          <WhatsAppIcon size={18} color="#25D366" />
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ======================================================== */}
          {/* STEP 1: CHOOSE OFFER TEMPLATE AS A DROPDOWN              */}
          {/* ======================================================== */}
          <View style={styles.stepHeaderRow}>
            <View style={[styles.stepNumberBadge, { backgroundColor: colors.accent }]}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.stepTitle, { color: colors.text }]}>
                Campaign & Festival Template
              </Text>
              <Text style={[styles.stepSub, { color: colors.textDim }]}>
                Choose from preset festivals or create a custom ad
              </Text>
            </View>
          </View>

          {/* Toggle Type Row: Festival vs Recall */}
          <View style={[styles.toggleTypeContainer, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                setSelectedTemplateType('festival');
                setIsDropdownOpen(false);
              }}
              style={[
                styles.typeToggleTab,
                selectedTemplateType === 'festival' && {
                  backgroundColor: colors.accent900,
                  borderColor: colors.accent,
                  borderWidth: 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.typeToggleText,
                  {
                    color: selectedTemplateType === 'festival' ? colors.accent100 : colors.textDim,
                    fontWeight: selectedTemplateType === 'festival' ? '700' : '500',
                  },
                ]}
              >
                🎉 Festival & Promo Ads
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                setSelectedTemplateType('standard');
                setIsDropdownOpen(false);
              }}
              style={[
                styles.typeToggleTab,
                selectedTemplateType === 'standard' && {
                  backgroundColor: colors.accent900,
                  borderColor: colors.accent,
                  borderWidth: 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.typeToggleText,
                  {
                    color: selectedTemplateType === 'standard' ? colors.accent100 : colors.textDim,
                    fontWeight: selectedTemplateType === 'standard' ? '700' : '500',
                  },
                ]}
              >
                ⚡ Recall & Nudges
              </Text>
            </TouchableOpacity>
          </View>

          {/* DROPDOWN SELECTOR BOX */}
          <View style={styles.dropdownSection}>
            <Text style={[styles.inputLabel, { color: colors.textDim }]}>
              {selectedTemplateType === 'festival' ? 'Festival / Occasion Dropdown:' : 'Recall & Nudge Type Dropdown:'}
            </Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setIsDropdownOpen((prev) => !prev)}
              style={[
                styles.dropdownTrigger,
                {
                  backgroundColor: colors.surface,
                  borderColor: isDropdownOpen ? colors.accent : colors.divider,
                  borderWidth: isDropdownOpen ? 1.5 : 1,
                },
              ]}
            >
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text numberOfLines={1} style={[styles.dropdownTriggerText, { color: colors.text }]}>
                  {activeTemplateLabel}
                </Text>
              </View>
              <View style={[styles.chevronContainer, isDropdownOpen && { transform: [{ rotate: '180deg' }] }]}>
                <ChevronDownIcon size={18} color={colors.accent} />
              </View>
            </TouchableOpacity>

            {/* EXPANDED DROPDOWN MENU */}
            {isDropdownOpen && (
              <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.accent }]}>
                <ScrollView nestedScrollEnabled style={{ maxHeight: 250 }} keyboardShouldPersistTaps="handled">
                  {selectedTemplateType === 'festival' ? (
                    <>
                      {festivalTemplates.map((tmpl) => {
                        const isSelected = selectedFestivalId === tmpl.id;
                        return (
                          <TouchableOpacity
                            key={tmpl.id}
                            activeOpacity={0.7}
                            onPress={() => handleSelectFestivalTemplate(tmpl)}
                            style={[
                              styles.dropdownItem,
                              { borderBottomColor: colors.divider },
                              isSelected && {
                                backgroundColor: colors.isDark ? 'rgba(217, 119, 6, 0.15)' : 'rgba(217, 119, 6, 0.08)',
                              },
                            ]}
                          >
                            <Text style={{ fontSize: 18, marginRight: 8 }}>{getTemplateEmoji(tmpl.id)}</Text>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.dropdownItemTitle, { color: colors.text, fontWeight: isSelected ? '700' : '500' }]}>
                                {tmpl.title}
                              </Text>
                              <Text style={[styles.dropdownItemSub, { color: colors.textDim }]}>
                                {tmpl.category} · {tmpl.defaultOffer}
                              </Text>
                            </View>
                            {isSelected && <CheckIcon size={14} color={colors.accent} />}
                          </TouchableOpacity>
                        );
                      })}
                      {/* Option for Custom Offer */}
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={handleSelectCustomOffer}
                        style={[styles.dropdownItem, { borderBottomWidth: 0, backgroundColor: colors.isDark ? '#27272a' : '#f4f4f5' }]}
                      >
                        <Text style={{ fontSize: 18, marginRight: 8 }}>➕</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.dropdownItemTitle, { color: colors.accent, fontWeight: '700' }]}>
                            Custom / Create Your Own Offer
                          </Text>
                          <Text style={[styles.dropdownItemSub, { color: colors.textDim }]}>
                            Write custom title, discount & message
                          </Text>
                        </View>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      {standardTemplateKeys.map((key) => {
                        const isSelected = selectedStandardKey === key;
                        return (
                          <TouchableOpacity
                            key={key}
                            activeOpacity={0.7}
                            onPress={() => handleSelectStandardTemplate(key)}
                            style={[
                              styles.dropdownItem,
                              { borderBottomColor: colors.divider },
                              isSelected && {
                                backgroundColor: colors.isDark ? 'rgba(217, 119, 6, 0.15)' : 'rgba(217, 119, 6, 0.08)',
                              },
                            ]}
                          >
                            <Text style={{ fontSize: 18, marginRight: 8 }}>{getStandardEmoji(key)}</Text>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.dropdownItemTitle, { color: colors.text, fontWeight: isSelected ? '700' : '500' }]}>
                                {key}
                              </Text>
                              <Text style={[styles.dropdownItemSub, { color: colors.textDim }]}>
                                Customer Recall & Nudge
                              </Text>
                            </View>
                            {isSelected && <CheckIcon size={14} color={colors.accent} />}
                          </TouchableOpacity>
                        );
                      })}
                      {/* Option for Custom Nudge */}
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={handleSelectCustomOffer}
                        style={[styles.dropdownItem, { borderBottomWidth: 0, backgroundColor: colors.isDark ? '#27272a' : '#f4f4f5' }]}
                      >
                        <Text style={{ fontSize: 18, marginRight: 8 }}>➕</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.dropdownItemTitle, { color: colors.accent, fontWeight: '700' }]}>
                            Custom / Create Your Own Nudge
                          </Text>
                          <Text style={[styles.dropdownItemSub, { color: colors.textDim }]}>
                            Write personalized nudge message
                          </Text>
                        </View>
                      </TouchableOpacity>
                    </>
                  )}
                </ScrollView>
              </View>
            )}
          </View>

          {/* ======================================================== */}
          {/* STEP 2: EDIT OFFER & EVERYTHING (Freely Customizable)    */}
          {/* ======================================================== */}
          <View style={styles.stepHeaderRow}>
            <View style={[styles.stepNumberBadge, { backgroundColor: colors.accent }]}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.stepTitle, { color: colors.text }]}>
                Customize Ad Message
              </Text>
              <Text style={[styles.stepSub, { color: colors.textDim }]}>
                Edit title, discount, validity & wording freely
              </Text>
            </View>
          </View>

          <View style={[styles.editCard, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textDim }]}>Offer / Campaign Title</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.bg, borderColor: colors.divider, color: colors.text }]}
                value={offerTitle}
                onChangeText={setOfferTitle}
                placeholder="e.g. Diwali Festive Sparkle"
                placeholderTextColor={colors.placeholder || colors.textDim}
              />
            </View>

            <View style={[styles.twoInputsRow, isSmallScreen && { flexDirection: 'column', gap: 10 }]}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={[styles.inputLabel, { color: colors.textDim }]}>Discount / Benefit</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: colors.bg, borderColor: colors.divider, color: colors.text }]}
                  value={offerDiscount}
                  onChangeText={setOfferDiscount}
                  placeholder="e.g. 20% OFF or ₹150 OFF"
                  placeholderTextColor={colors.placeholder || colors.textDim}
                />
              </View>

              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={[styles.inputLabel, { color: colors.textDim }]}>Validity</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: colors.bg, borderColor: colors.divider, color: colors.text }]}
                  value={offerValidity}
                  onChangeText={setOfferValidity}
                  placeholder="e.g. Valid this week"
                  placeholderTextColor={colors.placeholder || colors.textDim}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <Text style={[styles.inputLabel, { color: colors.textDim, marginBottom: 0 }]}>
                  Message Body (WhatsApp Ad)
                </Text>
                <Text style={{ fontSize: 11, color: colors.textDim }}>
                  {message.length} chars
                </Text>
              </View>
              <TextInput
                style={[
                  styles.messageInput,
                  { backgroundColor: colors.bg, borderColor: colors.divider, color: colors.text },
                ]}
                multiline
                numberOfLines={4}
                value={message}
                onChangeText={setMessage}
                placeholder="Write your WhatsApp ad message here..."
                placeholderTextColor={colors.placeholder || colors.textDim}
              />
            </View>

            {/* Quick Insert Dynamic Tag Pills */}
            <View style={styles.tagsContainer}>
              <Text style={[styles.tagsHint, { color: colors.textDim }]}>Insert Tag:</Text>
              {['[name]', '[shop]', '[offer]', '[validity]'].map((tag) => (
                <TouchableOpacity
                  key={tag}
                  activeOpacity={0.7}
                  onPress={() => handleInsertTag(tag)}
                  style={[styles.tagPill, { backgroundColor: colors.accent900, borderColor: colors.accent }]}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.accent200 }}>
                    + {tag}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ======================================================== */}
          {/* STEP 3: PREVIEW WHATSAPP MESSAGE                         */}
          {/* ======================================================== */}
          <View style={styles.stepHeaderRow}>
            <View style={[styles.stepNumberBadge, { backgroundColor: colors.accent }]}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.stepTitle, { color: colors.text }]}>
                Live WhatsApp Ad Preview
              </Text>
              <Text style={[styles.stepSub, { color: colors.textDim }]}>
                Real-time simulation of customer WhatsApp chat screen
              </Text>
            </View>
          </View>

          <View style={[styles.whatsAppPreviewContainer, { borderColor: colors.divider }]}>
            {/* WhatsApp App Top Bar */}
            <View style={[styles.whatsAppHeaderBar, { backgroundColor: colors.isDark ? '#1F2C34' : '#075E54' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View style={styles.whatsAppAvatar}>
                  <Text style={styles.whatsAppAvatarText}>
                    {shopName ? shopName.slice(0, 1).toUpperCase() : 'S'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text numberOfLines={1} style={styles.whatsAppHeaderTitle}>
                      {shopName || 'StyleFleet Salon'}
                    </Text>
                    <Text style={{ color: '#25D366', fontSize: 11, fontWeight: '700' }}>✓</Text>
                  </View>
                  <Text style={styles.whatsAppHeaderSub}>Verified Business Account</Text>
                </View>
              </View>
              <WhatsAppIcon size={20} color="#25D366" />
            </View>

            {/* WhatsApp Chat Body */}
            <View style={[styles.whatsAppChatBody, { backgroundColor: colors.isDark ? '#0B141A' : '#EFEAE2' }]}>
              {/* Encryption Banner */}
              <View style={styles.encryptionBubble}>
                <Text style={styles.encryptionText}>
                  🔒 Messages and calls are end-to-end encrypted.
                </Text>
              </View>

              {/* Chat Bubble */}
              <View style={[styles.chatBubble, { backgroundColor: colors.isDark ? '#005C4B' : '#DCF8C6' }]}>
                <Text style={[styles.chatBubbleText, { color: colors.isDark ? '#E9EDEF' : '#111B21' }]}>
                  {previewText}
                </Text>
                <View style={styles.chatBubbleFooter}>
                  <Text style={[styles.chatTimeText, { color: colors.isDark ? '#8696A0' : '#667781' }]}>
                    {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                  </Text>
                  <Text style={styles.doubleCheckTicks}>✓✓</Text>
                </View>
              </View>
            </View>

            {/* Preview Footer note */}
            <View style={[styles.previewFooterBar, { backgroundColor: colors.surface, borderTopColor: colors.divider }]}>
              <Text style={[styles.previewSub, { color: colors.textDim }]}>
                ✨ Live preview showing how {sampleCustomerName} receives your ad
              </Text>
            </View>
          </View>

          {/* ======================================================== */}
          {/* STEP 4: SELECT CUSTOMERS & DIRECT WHATSAPP CHAT          */}
          {/* ======================================================== */}
          <View style={styles.stepHeaderRow}>
            <View style={[styles.stepNumberBadge, { backgroundColor: colors.accent }]}>
              <Text style={styles.stepNumberText}>4</Text>
            </View>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={[styles.stepTitle, { color: colors.text }]}>
                  Target Customers
                </Text>
                <Text style={[styles.stepSub, { color: colors.textDim }]}>
                  {selectedCount} selected · {sentCount} sent
                </Text>
              </View>
              <TouchableOpacity
                onPress={toggleSelectAll}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.selectAllBtn}
              >
                <Text style={[styles.selectAllBtnText, { color: colors.accent }]}>
                  {selectedCustomerIds.size === filteredCustomers.length && filteredCustomers.length > 0
                    ? 'Deselect All'
                    : 'Select All'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Audience Filter Chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            {[
              { id: 'all' as const, label: `All (${customers.length})` },
              { id: 'mvp' as const, label: `MVP ★ (${customers.filter((c) => c.is_starred).length})` },
              { id: 'dues' as const, label: `With Dues (${customers.filter((c) => (c.outstanding_due_minor || 0) > 0).length})` },
              { id: 'inactive' as const, label: 'Inactive (>30d)' },
            ].map((f) => (
              <Chip
                key={f.id}
                label={f.label}
                active={audienceFilter === f.id}
                onPress={() => setAudienceFilter(f.id)}
                size="sm"
              />
            ))}
          </ScrollView>

          {/* Search Box with Clear Button */}
          <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
            <SearchIcon size={15} color={colors.textDim} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search customer by name or phone..."
              placeholderTextColor={colors.placeholder || colors.textDim}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <CrossIcon size={14} color={colors.textDim} />
              </TouchableOpacity>
            )}
          </View>

          {/* Customer Selection Roster */}
          <View style={styles.customerList}>
            {filteredCustomers.length === 0 ? (
              <View style={[styles.emptyCustomerBox, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
                <Text style={{ color: colors.textDim, fontSize: 13, textAlign: 'center' }}>
                  No customers found matching this filter.
                </Text>
              </View>
            ) : (
              <>
                {filteredCustomers.slice(0, displayLimit).map((cust) => (
                  <CustomerRowItem
                    key={cust.id}
                    cust={cust}
                    isSelected={selectedCustomerIds.has(cust.id)}
                    isSent={sentCustomerIds.has(cust.id)}
                    onToggle={toggleSelectCustomer}
                    onSend={handleSendSingleWhatsApp}
                    colors={colors}
                  />
                ))}

                {filteredCustomers.length > displayLimit && (
                  <TouchableOpacity
                    onPress={() => setDisplayLimit((prev) => prev + 50)}
                    style={[
                      styles.showMoreBtn,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.divider,
                      },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.showMoreBtnText, { color: colors.accent }]}>
                      Show More Customers ({filteredCustomers.length - displayLimit} remaining)
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ======================================================== */}
      {/* STEP 5: BOTTOM STICKY ACTION BAR                         */}
      {/* ======================================================== */}
      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.divider,
          },
        ]}
      >
        <View style={styles.batchInfoRow}>
          <Text style={[styles.batchNote, { color: colors.textDim }]}>
            {sentCount > 0 ? `Sent to ${sentCount} of ${selectedCount} customers` : `Dispatches directly to client WhatsApp chat`}
          </Text>
        </View>
        <TouchableOpacity
          disabled={selectedCount === 0}
          activeOpacity={0.8}
          onPress={handleSendToTargetCustomers}
          style={[
            styles.sendBulkBtn,
            {
              backgroundColor: selectedCount === 0 ? (colors.isDark ? '#27272a' : '#e4e4e7') : '#25D366',
              opacity: selectedCount === 0 ? 0.6 : 1,
            },
          ]}
        >
          <WhatsAppIcon size={20} color={selectedCount === 0 ? colors.textDim : '#FFFFFF'} />
          <Text
            style={[
              styles.sendBulkBtnText,
              { color: selectedCount === 0 ? colors.textDim : '#FFFFFF' },
            ]}
          >
            {selectedCount === 0
              ? 'Select customers to send'
              : remainingCount > 0
              ? `Send to WhatsApp (${remainingCount} Remaining)`
              : `All ${selectedCount} Customers Sent ✓`}
          </Text>
        </TouchableOpacity>
      </View>
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
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 11.5,
    marginTop: 1,
  },
  headerWhatsAppBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
  },
  stepHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
    marginBottom: 10,
  },
  stepNumberBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '800',
  },
  stepTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  stepSub: {
    fontSize: 11,
    marginTop: 1,
  },
  toggleTypeContainer: {
    flexDirection: 'row',
    borderRadius: radii.md,
    borderWidth: 1,
    padding: 3,
    marginBottom: 12,
  },
  typeToggleTab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
  },
  typeToggleText: {
    fontSize: 12,
  },
  dropdownSection: {
    marginBottom: 14,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radii.md,
  },
  dropdownTriggerText: {
    fontSize: 14,
    fontWeight: '600',
  },
  chevronContainer: {
    marginLeft: 8,
  },
  dropdownMenu: {
    borderWidth: 1,
    borderRadius: radii.md,
    marginTop: 4,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
  },
  dropdownItemTitle: {
    fontSize: 13.5,
    marginBottom: 2,
  },
  dropdownItemSub: {
    fontSize: 11,
  },
  editCard: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: 14,
    marginBottom: 4,
  },
  inputGroup: {
    marginBottom: 12,
  },
  twoInputsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  inputLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    marginBottom: 5,
  },
  textInput: {
    height: 42,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  messageInput: {
    minHeight: 96,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    lineHeight: 18,
    textAlignVertical: 'top',
  },
  tagsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  tagsHint: {
    fontSize: 11,
    fontWeight: '500',
  },
  tagPill: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  whatsAppPreviewContainer: {
    borderWidth: 1,
    borderRadius: radii.lg,
    overflow: 'hidden',
    marginBottom: 6,
  },
  whatsAppHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  whatsAppAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#128C7E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  whatsAppAvatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  whatsAppHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
  whatsAppHeaderSub: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10.5,
  },
  whatsAppChatBody: {
    padding: 12,
    paddingBottom: 16,
  },
  encryptionBubble: {
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 10,
  },
  encryptionText: {
    fontSize: 10,
    color: '#667781',
    textAlign: 'center',
  },
  chatBubble: {
    borderRadius: radii.md,
    borderTopLeftRadius: 3,
    padding: 10,
    paddingBottom: 6,
    maxWidth: '92%',
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  chatBubbleText: {
    fontSize: 13,
    lineHeight: 18.5,
  },
  chatBubbleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
    marginTop: 4,
  },
  chatTimeText: {
    fontSize: 10,
  },
  doubleCheckTicks: {
    color: '#53BDEB',
    fontSize: 11,
    fontWeight: '700',
  },
  previewFooterBar: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  previewSub: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  selectAllBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  selectAllBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 4,
    marginBottom: 8,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 40,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
  },
  customerList: {
    gap: 8,
    marginBottom: 16,
  },
  emptyCustomerBox: {
    padding: 18,
    borderWidth: 1,
    borderRadius: radii.sm,
    alignItems: 'center',
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderWidth: 1,
    borderRadius: radii.md,
  },
  customerCheckArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkBox: {
    width: 19,
    height: 19,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  customerAvatarText: {
    fontSize: 12,
    fontWeight: '700',
  },
  customerName: {
    fontSize: 13,
    fontWeight: '600',
  },
  customerPhone: {
    fontSize: 11.5,
    marginTop: 1,
  },
  dueMiniPill: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  dueMiniPillText: {
    color: '#EF4444',
    fontSize: 10,
    fontWeight: '700',
  },
  singleSendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: radii.sm,
    borderWidth: 1,
    marginLeft: 8,
  },
  bottomBar: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 8,
  },
  batchInfoRow: {
    alignItems: 'center',
    marginBottom: 8,
  },
  batchNote: {
    fontSize: 11.5,
  },
  sendBulkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: radii.md,
  },
  sendBulkBtnText: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  showMoreBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginTop: 4,
    marginBottom: 8,
  },
  showMoreBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

interface CustomerRowItemProps {
  cust: Customer;
  isSelected: boolean;
  isSent: boolean;
  onToggle: (id: string) => void;
  onSend: (cust: Customer) => void;
  colors: any;
}

const CustomerRowItem = React.memo(
  ({ cust, isSelected, isSent, onToggle, onSend, colors }: CustomerRowItemProps) => {
    const initial = cust.name ? cust.name.slice(0, 1).toUpperCase() : '?';

    return (
      <View
        style={[
          styles.customerRow,
          {
            backgroundColor: isSelected
              ? (colors.isDark ? 'rgba(217, 119, 6, 0.12)' : 'rgba(217, 119, 6, 0.08)')
              : colors.surface,
            borderColor: isSelected ? colors.accent : colors.divider,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => onToggle(cust.id)}
          style={styles.customerCheckArea}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.checkBox,
              {
                backgroundColor: isSelected ? colors.accent : 'transparent',
                borderColor: isSelected ? colors.accent : colors.textDim,
              },
            ]}
          >
            {isSelected && <CheckIcon size={11} color="#FFFFFF" />}
          </View>

          <View
            style={[
              styles.customerAvatar,
              { backgroundColor: colors.isDark ? '#27272a' : '#f4f4f5' },
            ]}
          >
            <Text style={[styles.customerAvatarText, { color: colors.text }]}>
              {initial}
            </Text>
          </View>

          <View style={{ flex: 1, marginLeft: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text numberOfLines={1} style={[styles.customerName, { color: colors.text }]}>
                {cust.name}
              </Text>
              {cust.is_starred && (
                <Text style={{ fontSize: 11, color: colors.accent, fontWeight: '700' }}>★ MVP</Text>
              )}
              {(cust.outstanding_due_minor || 0) > 0 && (
                <View style={styles.dueMiniPill}>
                  <Text style={styles.dueMiniPillText}>
                    Due ₹{Math.round((cust.outstanding_due_minor || 0) / 100)}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[styles.customerPhone, { color: colors.textDim }]}>
              +91 {cust.phone}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Direct WhatsApp Chat Opener */}
        <TouchableOpacity
          onPress={() => onSend(cust)}
          style={[
            styles.singleSendBtn,
            {
              backgroundColor: isSent ? (colors.isDark ? '#064e3b' : '#dcfce7') : '#25D366',
              borderColor: isSent ? '#10b981' : '#22c55e',
            },
          ]}
          activeOpacity={0.7}
        >
          {isSent ? (
            <CheckIcon size={12} color="#10b981" />
          ) : (
            <WhatsAppIcon size={13} color="#FFFFFF" />
          )}
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              color: isSent ? '#10b981' : '#FFFFFF',
            }}
          >
            {isSent ? 'Sent' : 'Chat'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }
);
