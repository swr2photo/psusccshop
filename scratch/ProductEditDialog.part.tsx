const ProductEditDialog = ({
  product,
  onClose,
  onChange,
  onSave,
  isSaving,
  showToast,
}: {
  product: Product;
  onClose: () => void;
  onChange: (p: Product) => void;
  onSave: (mode?: 'publish' | 'draft') => void;
  isSaving: boolean;
  showToast?: (type: 'success' | 'error' | 'info' | 'warning', message: string) => void;
}): JSX.Element => {
  const [newSizeKey, setNewSizeKey] = useState('');
  const [newSizePrice, setNewSizePrice] = useState<number | ''>('');
  const [coverUploadLoading, setCoverUploadLoading] = useState(false);
  const [newVariantName, setNewVariantName] = useState('');
  const [newVariantPrice, setNewVariantPrice] = useState<number | ''>('');
  const [newVariantStock, setNewVariantStock] = useState<number | ''>('');
  const [newPatternName, setNewPatternName] = useState('');
  const [newPatternImage, setNewPatternImage] = useState('');
  const [newTagText, setNewTagText] = useState('');
  const [newTagColor, setNewTagColor] = useState('#10b981');
  const MAX_IMAGE_SIZE = 3 * 1024 * 1024;

  const productAny = product as Product & Record<string, unknown>;
  const isMobileDevice = useIsMobile(600);

  const needsVariants = () => {
    const category = productAny.category as string | undefined;
    return category && category !== 'APPAREL';
  };

  useEffect(() => {
    if (product && !product.coverImage && Array.isArray(product.images) && product.images.length > 0) {
      onChange({ ...product, coverImage: product.images[0] });
    }
  }, [product, onChange]);

  const filterValidFiles = (files: FileList | null) => {
    if (!files) return [];
    return Array.from(files).filter((file) => file.type.startsWith('image/') && file.size <= MAX_IMAGE_SIZE);
  };

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleAddVariant = () => {
    if (!newVariantName.trim()) return;
    const newVariant = {
      id: `var_${Date.now()}`,
      name: newVariantName.trim(),
      price: typeof newVariantPrice === 'number' ? newVariantPrice : product.basePrice || 0,
      stock: typeof newVariantStock === 'number' ? newVariantStock : null,
      isActive: true,
    };
    const variants = [...((productAny.variants as unknown[]) || []), newVariant];
    onChange({ ...product, variants } as Product);
    setNewVariantName('');
    setNewVariantPrice('');
    setNewVariantStock('');
  };

  const handleUpdateVariant = (variantId: string, field: string, value: unknown) => {
    const variants = ((productAny.variants as Array<Record<string, unknown>>) || []).map((v) =>
      v.id === variantId ? { ...v, [field]: value } : v
    );
    onChange({ ...product, variants } as Product);
  };

  const handleRemoveVariant = (variantId: string) => {
    const variants = ((productAny.variants as Array<{ id: string }>) || []).filter((v) => v.id !== variantId);
    onChange({ ...product, variants } as Product);
  };

  const handleAddPattern = () => {
    if (!newPatternName.trim()) return;
    const names = newPatternName.split(/[\n,;]+/).map((n) => n.trim()).filter((n) => n.length > 0);
    if (names.length === 0) return;
    const newPatterns = names.map((name, index) => ({
      id: `pat_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 6)}`,
      name,
      image: index === 0 && newPatternImage ? newPatternImage : undefined,
      isActive: true,
    }));
    const patterns = [...((productAny.patterns as unknown[]) || []), ...newPatterns];
    onChange({ ...product, patterns } as Product);
    setNewPatternName('');
    setNewPatternImage('');
    if (names.length > 1) showToast?.('success', `เพิ่มสำเร็จ ${names.length} ลาย`);
  };

  const handleUpdatePattern = (patternId: string, field: string, value: unknown) => {
    const patterns = ((productAny.patterns as Array<Record<string, unknown>>) || []).map((p) =>
      p.id === patternId ? { ...p, [field]: value } : p
    );
    onChange({ ...product, patterns } as Product);
  };

  const handleRemovePattern = (patternId: string) => {
    const allPatterns = (productAny.patterns as Array<{ id: string; image?: string }>) || [];
    const removed = allPatterns.find((p) => p.id === patternId);
    const patterns = allPatterns.filter((p) => p.id !== patternId);
    const nextCover =
      removed?.image && removed.image === product.coverImage
        ? (product.images || []).find((img) => img !== removed.image) || ''
        : product.coverImage;
    onChange({ ...product, patterns, coverImage: nextCover } as Product);
  };

  const handlePatternImageUpload = async (patternId: string, files: FileList | null) => {
    const validFiles = filterValidFiles(files);
    if (validFiles.length === 0) return;
    handleUpdatePattern(patternId, 'image', await readFileAsDataUrl(validFiles[0]));
  };

  const handleNewPatternImageUpload = async (files: FileList | null) => {
    const validFiles = filterValidFiles(files);
    if (validFiles.length === 0) return;
    if (validFiles.length === 1) {
      setNewPatternImage(await readFileAsDataUrl(validFiles[0]));
    } else {
      const newPatterns = await Promise.all(
        validFiles.map(async (file, index) => {
          const dataUrl = await readFileAsDataUrl(file);
          const name = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
          return { id: `pat_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 6)}`, name: name.trim(), image: dataUrl, isActive: true };
        })
      );
      onChange({ ...product, patterns: [...((productAny.patterns as unknown[]) || []), ...newPatterns] } as Product);
      showToast?.('success', `เพิ่มสำเร็จ ${newPatterns.length} ลายจากไฟล์ภาพ`);
    }
  };

  const handleSizePriceChange = (size: string, price: number) => {
    if (!size || Number.isNaN(price)) return;
    const next = { ...(product.sizePricing || {}) };
    next[size] = Math.max(0, price);
    onChange({ ...product, sizePricing: next });
  };

  const handleRemoveSize = (size: string) => {
    const next = { ...(product.sizePricing || {}) };
    delete next[size];
    onChange({ ...product, sizePricing: next });
  };

  const handleAddSize = () => {
    const key = newSizeKey.trim();
    if (!key) return;
    handleSizePriceChange(key, typeof newSizePrice === 'number' ? newSizePrice : product.basePrice || 0);
    setNewSizeKey('');
    setNewSizePrice('');
  };

  const handleImagesUpload = async (files: FileList | null) => {
    const validFiles = filterValidFiles(files);
    if (validFiles.length === 0) return;
    const dataUrls = await Promise.all(validFiles.map(readFileAsDataUrl));
    const merged = [...(product.images || []), ...dataUrls];
    onChange({ ...product, images: merged, coverImage: product.coverImage || merged[0] || '' });
  };

  const handleRemoveImage = (imgUrl: string) => {
    const nextImages = (product.images || []).filter((img) => img !== imgUrl);
    onChange({ ...product, images: nextImages, coverImage: imgUrl === product.coverImage ? nextImages[0] || '' : product.coverImage || '' });
  };

  const handleSetCover = (img: string) => {
    if (!img) return;
    const images = product.images || [];
    onChange({ ...product, coverImage: img, images: images.includes(img) ? images : [img, ...images] });
  };

  const handleCoverUpload = async (files: FileList | null) => {
    const validFiles = filterValidFiles(files);
    if (validFiles.length === 0) return;
    setCoverUploadLoading(true);
    try {
      const dataUrl = await readFileAsDataUrl(validFiles[0]);
      const merged = [...(product.images || []), dataUrl];
      onChange({ ...product, images: merged, coverImage: dataUrl });
    } finally {
      setCoverUploadLoading(false);
    }
  };

  const category = (productAny.category as string) || 'OTHER';
  const subType = (productAny.subType as string) || product.type || 'OTHER';
  const subtypeOptions = [
    ...(PRODUCT_SUBTYPES[category] || ['OTHER']),
    'ของขวัญ', 'ชุดกีฬา', 'อุปกรณ์', 'เครื่องเขียน', 'กระเป๋า', 'รองเท้า', 'หมวก', 'ผ้าพันคอ',
  ];

  const sortedImages = (() => {
    const images = product.images || [];
    const coverImage = product.coverImage;
    const merged = coverImage && !images.includes(coverImage) ? [coverImage, ...images] : images;
    return coverImage ? [coverImage, ...merged.filter((img) => img !== coverImage)] : merged;
  })();

  const { status: scheduleStatus } = isProductOpen(product);
  const scheduleInfo: Record<string, { icon: React.ReactNode; text: string; color: string }> = {
    upcoming: { icon: <AccessTime size={16} />, text: 'สินค้าจะเปิดขายเมื่อถึงเวลาที่กำหนด', color: '#f59e0b' },
    active: { icon: <FiberManualRecord size={12} className="text-green-500" />, text: 'สินค้ากำลังเปิดขายอยู่', color: '#10b981' },
    ended: { icon: <FiberManualRecord size={12} className="text-red-500" />, text: 'หมดเวลาขายแล้ว', color: '#ef4444' },
    always: { icon: <DateRange size={16} />, text: 'ไม่มีกำหนดเวลา (เปิดตลอด)', color: 'var(--text-muted)' },
  };
  const schedulePreview = scheduleInfo[scheduleStatus];

  return (
    <Dialog open={!!product} onOpenChange={() => {}}>
      <DialogContent
        showCloseButton={false}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className={cn(
          'max-h-[95vh] overflow-y-auto border-[var(--glass-border)] bg-[var(--glass-strong)] p-0 text-[var(--foreground)]',
          isMobileDevice ? 'h-full max-w-full rounded-none' : 'max-w-3xl rounded-2xl'
        )}
      >
        <div className="relative bg-gradient-to-br from-indigo-500 to-violet-500 px-6 py-4">
          <DialogTitle className="text-left font-bold text-white">
            {product.id.startsWith('prod_') ? 'New' : 'Edit'} Product
          </DialogTitle>
          <button type="button" onClick={onClose} className="absolute right-3 top-3 text-white hover:opacity-80">
            <Close size={20} />
          </button>
        </div>

        <div className="grid gap-4 p-4 md:grid-cols-[2fr_1fr]">
          <div className="flex flex-col gap-4">
            <div className="space-y-1.5">
              <Label>Product Name</Label>
              <Input className={inputClass} value={product.name} onChange={(e) => onChange({ ...product, name: e.target.value })} />
            </div>

            <div className="space-y-1.5">
              <Label>Slug (ลิงก์สินค้า)</Label>
              <Input
                className={inputClass}
                value={(productAny.slug as string) || ''}
                placeholder={product.name.replace(/[^\u0E00-\u0E7Fa-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-').toLowerCase() || 'auto-generated'}
                onChange={(e) =>
                  onChange({
                    ...product,
                    slug: e.target.value.replace(/[^a-zA-Z0-9\u0E00-\u0E7F\s-]/g, '').replace(/\s+/g, '-').toLowerCase(),
                  } as Product)
                }
              />
              <p className="text-xs text-[var(--text-muted)]">
                ลิงก์: {typeof window !== 'undefined' ? window.location.origin : ''}/?p={product.id}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>หมวดหมู่</Label>
                <Input
                  className={inputClass}
                  list="category-list"
                  value={category}
                  onChange={(e) => {
                    const newCategory = e.target.value || 'OTHER';
                    const subTypes = PRODUCT_SUBTYPES[newCategory] || ['OTHER'];
                    onChange({
                      ...product,
                      category: newCategory,
                      subType: subTypes[0] || 'OTHER',
                      type: newCategory === 'APPAREL' ? product.type || 'CREW' : 'OTHER',
                    } as Product);
                  }}
                />
                <datalist id="category-list">
                  {PRODUCT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>
                  ))}
                </datalist>
              </div>
              <div className="space-y-1.5">
                <Label>ประเภทย่อย</Label>
                <Input
                  className={inputClass}
                  list="subtype-list"
                  value={subType}
                  onChange={(e) => {
                    const val = e.target.value || 'OTHER';
                    onChange({
                      ...product,
                      subType: val,
                      type: ['JERSEY', 'CREW'].includes(val) ? (val as Product['type']) : 'OTHER',
                    } as Product);
                  }}
                />
                <datalist id="subtype-list">
                  {subtypeOptions.map((s) => (
                    <option key={s} value={s}>{SUBTYPE_LABELS[s] || s}</option>
                  ))}
                </datalist>
                <p className="text-xs text-[var(--text-muted)]">พิมพ์ชื่อประเภทเองได้</p>
              </div>
            </div>

            <input type="hidden" value={product.type} readOnly />

            <div className="space-y-1.5">
              <Label>Description (รองรับการเว้นบรรทัด)</Label>
              <Textarea
                className={inputClass}
                rows={4}
                value={product.description}
                onChange={(e) => onChange({ ...product, description: e.target.value })}
                placeholder={'เช่น:\nเสื้อ Jersey รุ่นใหม่\nเนื้อผ้า: Cool Elite\nดีไซน์: แขนสั้นและยาว'}
              />
              <p className="text-xs text-[var(--text-muted)]">กด Enter เพื่อเว้นบรรทัดใหม่</p>
            </div>

            {(category === 'CAMP_FEE' || subType === 'CAMP_REGISTRATION') && (
              <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
                <p className="flex items-center gap-2 text-sm font-bold text-amber-400"><Tent size={16} /> ข้อมูลค่าย</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {[
                    { key: 'campName', label: 'ชื่อค่าย', type: 'text' },
                    { key: 'campDate', label: 'วันที่จัดค่าย', type: 'date' },
                    { key: 'location', label: 'สถานที่', type: 'text' },
                    { key: 'organizer', label: 'ผู้จัด', type: 'text' },
                    { key: 'maxParticipants', label: 'จำนวนรับสูงสุด', type: 'number' },
                  ].map(({ key, label, type }) => (
                    <div key={key} className="space-y-1.5">
                      <Label>{label}</Label>
                      <Input
                        type={type}
                        className={inputClass}
                        value={String((productAny.campInfo as Record<string, unknown>)?.[key] ?? '')}
                        onChange={(e) =>
                          onChange({
                            ...product,
                            campInfo: {
                              ...((productAny.campInfo as Record<string, unknown>) || {}),
                              [key]: type === 'number' ? Number(e.target.value) || 0 : e.target.value,
                            },
                          } as Product)
                        }
                      />
                    </div>
                  ))}
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>เงื่อนไข/ข้อกำหนด</Label>
                    <Textarea
                      className={inputClass}
                      rows={2}
                      value={String((productAny.campInfo as Record<string, unknown>)?.requirements ?? '')}
                      onChange={(e) =>
                        onChange({
                          ...product,
                          campInfo: { ...((productAny.campInfo as Record<string, unknown>) || {}), requirements: e.target.value },
                        } as Product)
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            {(category === 'EVENT' || subType === 'EVENT_TICKET') && (
              <div className="space-y-3 rounded-lg border border-pink-500/30 bg-pink-500/10 p-4">
                <p className="flex items-center gap-2 text-sm font-bold text-pink-400"><Ticket size={16} /> ข้อมูลอีเวนต์</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {[
                    { key: 'eventName', label: 'ชื่ออีเวนต์', type: 'text' },
                    { key: 'eventDate', label: 'วันที่จัดงาน', type: 'datetime-local' },
                    { key: 'venue', label: 'สถานที่', type: 'text' },
                    { key: 'organizer', label: 'ผู้จัด', type: 'text' },
                  ].map(({ key, label, type }) => (
                    <div key={key} className="space-y-1.5">
                      <Label>{label}</Label>
                      <Input
                        type={type}
                        className={inputClass}
                        value={String((productAny.eventInfo as Record<string, unknown>)?.[key] ?? '')}
                        onChange={(e) =>
                          onChange({
                            ...product,
                            eventInfo: { ...((productAny.eventInfo as Record<string, unknown>) || {}), [key]: e.target.value },
                          } as Product)
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(category === 'APPAREL' || !productAny.category) && (
              <div className={sectionClass}>
                <p className="flex items-center gap-1 text-sm font-bold"><Settings size={16} /> ตัวเลือกเสื้อ</p>
                <div className="flex items-center justify-between">
                  <Label>ต้องเลือกไซส์</Label>
                  <Switch
                    checked={product.options?.requiresSize !== false}
                    onCheckedChange={(checked) => onChange({ ...product, options: { ...product.options, requiresSize: checked } } as Product)}
                    className="data-[state=checked]:bg-emerald-500"
                  />
                </div>
              </div>
            )}

            <div className={sectionClass}>
              <p className="flex items-center gap-1 text-sm font-bold"><Inventory size={16} /> จำนวนสินค้า</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>จำนวนในสต็อก (ปล่อยว่าง = ไม่จำกัด)</Label>
                  <Input
                    type="number"
                    min={0}
                    className={inputClass}
                    value={productAny.stock != null ? String(productAny.stock) : ''}
                    onChange={(e) => onChange({ ...product, stock: e.target.value === '' ? null : Number(e.target.value) } as Product)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>จำนวนสูงสุดต่อออเดอร์</Label>
                  <Input
                    type="number"
                    min={1}
                    className={inputClass}
                    value={productAny.maxPerOrder != null ? String(productAny.maxPerOrder) : ''}
                    onChange={(e) => onChange({ ...product, maxPerOrder: e.target.value === '' ? null : Number(e.target.value) } as Product)}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Base Price (฿)</Label>
              <Input
                type="number"
                min={0}
                max={999999}
                className={inputClass}
                value={product.basePrice}
                onChange={(e) => onChange({ ...product, basePrice: Number(e.target.value) })}
              />
            </div>

            {(category === 'APPAREL' || !productAny.category) && productAny.options?.requiresSize !== false && (
              <div className={sectionClass}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold">ราคาต่อไซส์</p>
                  <p className="text-xs text-[var(--text-muted)]">ปล่อยว่างจะใช้ราคา base</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {SIZES.map((size) => (
                    <Badge
                      key={size}
                      variant="outline"
                      className={cn('cursor-pointer font-bold', product.sizePricing?.[size] && 'border-indigo-500/40 bg-indigo-500/15')}
                      onClick={() => handleSizePriceChange(size, product.basePrice || 0)}
                    >
                      {product.sizePricing?.[size] ? `${size}: ${product.sizePricing[size].toLocaleString()}฿` : `ตั้งราคา ${size}`}
                    </Badge>
                  ))}
                </div>
                {Object.entries(product.sizePricing || {}).map(([size, price]) => (
                  <div key={size} className="grid grid-cols-[1fr_auto] items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      className={inputClass}
                      value={price}
                      onChange={(e) => handleSizePriceChange(size, Number(e.target.value))}
                      placeholder={`ไซส์ ${size}`}
                    />
                    <Button variant="ghost" size="icon" onClick={() => handleRemoveSize(size)} className="text-red-400">
                      <Delete size={18} />
                    </Button>
                  </div>
                ))}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <Input className={inputClass} placeholder="เพิ่มไซส์ใหม่" value={newSizeKey} onChange={(e) => setNewSizeKey(e.target.value.trimStart())} />
                  <Input type="number" className={inputClass} placeholder="ราคา (฿)" value={newSizePrice} onChange={(e) => setNewSizePrice(e.target.value === '' ? '' : Number(e.target.value))} />
                  <Button onClick={handleAddSize} className={gradientBtnClass}><Add size={16} className="mr-1" /> เพิ่มไซส์</Button>
                </div>
              </div>
            )}

            {needsVariants() && (
              <div className="space-y-3 rounded-lg border border-violet-500/30 bg-violet-500/10 p-4">
                <p className="flex items-center gap-2 text-sm font-bold text-violet-400"><Palette size={16} /> ตัวเลือกสินค้า (Variants)</p>
                {((productAny.variants as Array<Record<string, unknown>>) || []).map((variant) => (
                  <div key={String(variant.id)} className="grid grid-cols-1 items-center gap-2 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] p-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
                    <Input className={inputClass} value={String(variant.name)} onChange={(e) => handleUpdateVariant(String(variant.id), 'name', e.target.value)} placeholder="ชื่อตัวเลือก" />
                    <Input type="number" className={inputClass} value={Number(variant.price)} onChange={(e) => handleUpdateVariant(String(variant.id), 'price', Number(e.target.value))} placeholder="ราคา" />
                    <Input type="number" className={inputClass} value={variant.stock != null ? String(variant.stock) : ''} onChange={(e) => handleUpdateVariant(String(variant.id), 'stock', e.target.value === '' ? null : Number(e.target.value))} placeholder="ไม่จำกัด" />
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleUpdateVariant(String(variant.id), 'isActive', !variant.isActive)} className={variant.isActive ? 'text-green-500' : 'text-slate-500'}>
                        {variant.isActive ? <Visibility size={18} /> : <VisibilityOff size={18} />}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleRemoveVariant(String(variant.id))} className="text-red-400"><Delete size={18} /></Button>
                    </div>
                  </div>
                ))}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
                  <Input className={inputClass} value={newVariantName} onChange={(e) => setNewVariantName(e.target.value)} placeholder="ชื่อตัวเลือกใหม่" />
                  <Input type="number" className={inputClass} value={newVariantPrice} onChange={(e) => setNewVariantPrice(e.target.value === '' ? '' : Number(e.target.value))} placeholder={`${product.basePrice || 0}`} />
                  <Input type="number" className={inputClass} value={newVariantStock} onChange={(e) => setNewVariantStock(e.target.value === '' ? '' : Number(e.target.value))} placeholder="ไม่จำกัด" />
                  <Button onClick={handleAddVariant} className="bg-gradient-to-br from-violet-500 to-indigo-500 text-white"><Add size={16} /> เพิ่ม</Button>
                </div>
                <div>
                  <p className="mb-2 text-xs text-[var(--text-muted)]">เพิ่มตัวเลือกด่วน:</p>
                  <div className="flex flex-wrap gap-1">
                    {[
                      { name: 'ขนาด S', price: product.basePrice },
                      { name: 'ขนาด M', price: product.basePrice },
                      { name: 'ขนาด L', price: product.basePrice },
                      { name: 'สีดำ', price: product.basePrice },
                      { name: 'สีขาว', price: product.basePrice },
                      { name: 'ปกติ', price: product.basePrice },
                      { name: 'พิเศษ', price: Math.round((product.basePrice || 0) * 1.2) },
                    ].map((preset) => {
                      const exists = ((productAny.variants as Array<{ name: string }>) || []).some((v) => v.name === preset.name);
                      return (
                        <Badge
                          key={preset.name}
                          variant="outline"
                          className={cn('cursor-pointer border-dashed border-violet-500/50 text-violet-400', exists && 'opacity-50')}
                          onClick={() => {
                            if (exists) return;
                            onChange({
                              ...product,
                              variants: [
                                ...((productAny.variants as unknown[]) || []),
                                { id: `var_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`, name: preset.name, price: preset.price || 0, stock: null, isActive: true },
                              ],
                            } as Product);
                          }}
                        >
                          {preset.name}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <div className={sectionClass}>
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-amber-600">
                  <DateRange size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold">กำหนดเวลาขาย</p>
                  <p className="text-xs text-[var(--text-muted)]">ตั้งเวลาเปิด-ปิดขายอัตโนมัติ</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1 text-[var(--text-muted)]"><FiberManualRecord size={10} className="text-green-500" /> เปิดขายเมื่อ</Label>
                  <Input type="datetime-local" className={inputClass} value={toDateTimeLocal(product.startDate)} onChange={(e) => onChange({ ...product, startDate: e.target.value })} />
                  {product.startDate && (
                    <Button variant="ghost" size="sm" className="h-auto p-0 text-xs text-[var(--text-muted)]" onClick={() => onChange({ ...product, startDate: '' })}>✕ ล้างวันเริ่ม</Button>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1 text-[var(--text-muted)]"><FiberManualRecord size={10} className="text-red-500" /> ปิดขายเมื่อ</Label>
                  <Input type="datetime-local" className={inputClass} value={toDateTimeLocal(product.endDate)} onChange={(e) => onChange({ ...product, endDate: e.target.value })} />
                  {product.endDate && (
                    <Button variant="ghost" size="sm" className="h-auto p-0 text-xs text-[var(--text-muted)]" onClick={() => onChange({ ...product, endDate: '' })}>✕ ล้างวันสิ้นสุด</Button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg p-3" style={{ backgroundColor: `${schedulePreview.color}15`, border: `1px solid ${schedulePreview.color}30` }}>
                <span style={{ color: schedulePreview.color }}>{schedulePreview.icon}</span>
                <p className="text-sm font-medium" style={{ color: schedulePreview.color }}>{schedulePreview.text}</p>
              </div>
            </div>

            <div className={sectionClass}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold">รูปภาพสินค้า</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild className="border-[var(--glass-border)]">
                    <label>เพิ่มหลายรูป<input hidden accept="image/*" multiple type="file" onChange={(e) => handleImagesUpload(e.target.files)} /></label>
                  </Button>
                  <Button size="sm" disabled={coverUploadLoading} asChild className={gradientBtnClass}>
                    <label>{coverUploadLoading ? '...' : 'ตั้งรูปปก'}<input hidden accept="image/*" type="file" onChange={(e) => handleCoverUpload(e.target.files)} /></label>
                  </Button>
                </div>
              </div>
              <p className="text-xs text-[var(--text-muted)]">รองรับหลายไฟล์ บันทึกเป็น Data URL · ตั้งปกได้จากรูปสินค้าหรือรูปลายเสื้อด้านล่าง</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {sortedImages.map((img, idx) => {
                  const isCover = product.coverImage === img;
                  return (
                    <div key={idx} className={cn('relative overflow-hidden rounded-xl border', isCover ? 'border-indigo-500 ring-2 ring-indigo-500/35' : 'border-[var(--glass-border)]')}>
                      {isCover && <Badge className="absolute left-1.5 top-1.5 z-10 bg-indigo-500">รูปปก</Badge>}
                      <img src={img} alt={`product-${idx}`} className="block h-[140px] w-full object-cover" />
                      <div className="absolute inset-0 flex flex-col justify-end gap-1 p-2">
                        <Button size="sm" className="bg-indigo-500/90 text-white" onClick={() => handleSetCover(img)}>ตั้งเป็นปก</Button>
                        <Button size="sm" variant="outline" className="border-[var(--glass-border)] text-white" onClick={() => handleRemoveImage(img)}>ลบรูป</Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {((productAny.category || (product.type === 'OTHER' ? 'OTHER' : 'APPAREL')) === 'APPAREL') && (
              <div className="space-y-3 rounded-lg border border-sky-500/30 bg-sky-500/10 p-4">
                <p className="flex items-center gap-2 text-sm font-bold text-sky-400"><Palette size={16} /> ลายเสื้อ (Patterns)</p>
                {(((productAny.patterns as Array<Record<string, unknown>>) || []) as Array<Record<string, unknown>>).length === 0 ? (
                  <p className="text-xs italic text-[var(--text-muted)]">ยังไม่มีลายสินค้า</p>
                ) : (
                  ((productAny.patterns as Array<Record<string, unknown>>) || []).map((pattern) => {
                    const isActive = pattern.isActive !== false;
                    const isPatternCover = Boolean(pattern.image && product.coverImage === pattern.image);
                    return (
                      <div key={String(pattern.id)} className={cn('grid grid-cols-1 items-center gap-2 rounded-lg border bg-[var(--glass-bg)] p-3 sm:grid-cols-[140px_1fr_auto]', isPatternCover ? 'border-indigo-500 ring-2 ring-indigo-500/35' : 'border-[var(--glass-border)]')}>
                        <div className="relative flex h-[90px] w-full items-center justify-center overflow-hidden rounded-lg border border-[var(--glass-border)] bg-slate-900/40">
                          {isPatternCover && <Badge className="absolute left-1 top-1 z-10 h-5 bg-indigo-500 text-[0.65rem]">รูปปก</Badge>}
                          {pattern.image ? <img src={String(pattern.image)} alt={String(pattern.name)} className="h-full w-full object-cover" /> : <ImageIcon size={20} className="text-[var(--text-muted)]" />}
                        </div>
                        <div className="space-y-2">
                          <Input className={inputClass} value={String(pattern.name)} onChange={(e) => handleUpdatePattern(String(pattern.id), 'name', e.target.value)} placeholder="ชื่อลาย" />
                          <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" asChild><label>แนบ/เปลี่ยนรูปลาย<input hidden accept="image/*" type="file" onChange={(e) => handlePatternImageUpload(String(pattern.id), e.target.files)} /></label></Button>
                            {pattern.image && (
                              <Button size="sm" disabled={isPatternCover} className="bg-indigo-500/90" onClick={() => handleSetCover(String(pattern.image))}>
                                {isPatternCover ? 'เป็นปกแล้ว' : 'ตั้งเป็นปก'}
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleUpdatePattern(String(pattern.id), 'isActive', !isActive)} className={isActive ? 'text-green-500' : 'text-slate-500'}>
                            {isActive ? <Visibility size={18} /> : <VisibilityOff size={18} />}
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleRemovePattern(String(pattern.id))} className="text-red-400"><Delete size={18} /></Button>
                        </div>
                      </div>
                    );
                  })
                )}
                <div className="grid grid-cols-1 items-center gap-2 md:grid-cols-[2fr_1fr_auto]">
                  <Input className={inputClass} value={newPatternName} onChange={(e) => setNewPatternName(e.target.value)} placeholder="ชื่อลายใหม่ (คั่นด้วย ,)" />
                  <Button variant="outline" size="sm" asChild><label>แนบรูปลาย<input hidden accept="image/*" type="file" multiple onChange={(e) => handleNewPatternImageUpload(e.target.files)} /></label></Button>
                  <Button size="sm" onClick={handleAddPattern} className="bg-gradient-to-br from-sky-400 to-sky-500 text-white"><Add size={16} /> เพิ่มลาย</Button>
                </div>
                {newPatternImage && (
                  <div className="flex items-center gap-2">
                    <img src={newPatternImage} alt="new-pattern" className="h-[60px] w-[90px] rounded-lg border border-[var(--glass-border)] object-cover" />
                    <Button variant="outline" size="sm" onClick={() => setNewPatternImage('')}>ลบรูปลาย</Button>
                  </div>
                )}
              </div>
            )}

            <div className={sectionClass}>
              <p className="text-sm font-bold">Product Options</p>
              {[
                { key: 'hasCustomName', label: 'Allow Custom Name' },
                { key: 'hasCustomNumber', label: 'Allow Custom Number' },
                { key: 'hasLongSleeve', label: 'Offer Long Sleeve' },
              ].map((opt) => (
                <div key={opt.key} className="flex items-center gap-2">
                  <Checkbox
                    id={opt.key}
                    checked={Boolean((product.options as Record<string, unknown>)?.[opt.key])}
                    onCheckedChange={(checked) =>
                      onChange({
                        ...product,
                        options: {
                          ...(product.options || { hasCustomName: false, hasCustomNumber: false, hasLongSleeve: false, longSleevePrice: 50 }),
                          [opt.key]: checked === true,
                        },
                      })
                    }
                  />
                  <Label htmlFor={opt.key}>{opt.label}</Label>
                </div>
              ))}
              {product.options?.hasLongSleeve && (
                <div className="ml-6 space-y-1.5">
                  <Label>ราคาเพิ่มแขนยาว (฿)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={999999}
                    className={cn(inputClass, 'w-44')}
                    value={product.options?.longSleevePrice ?? 50}
                    onChange={(e) => onChange({ ...product, options: { ...product.options, longSleevePrice: Math.max(0, Number(e.target.value)) } })}
                  />
                  <p className="text-xs text-[var(--text-muted)]">ราคาที่จะบวกเพิ่มเมื่อเลือกแขนยาว</p>
                </div>
              )}
              {product.options?.hasCustomName && (
                <div className="mt-3 border-t border-[var(--glass-border)] pt-3">
                  <p className="mb-3 flex items-center gap-2 text-sm font-bold"><Shirt size={18} /> ตั้งค่าชื่อบนเสื้อ (เฉพาะสินค้านี้)</p>
                  <ShirtNameConfigFields compact value={getProductShirtNameConfig(product)} onChange={(shirtNameConfig) => onChange({ ...product, shirtNameConfig })} />
                </div>
              )}
            </div>

            <div className={sectionClass}>
              <p className="flex items-center gap-2 text-sm font-bold"><LocalOffer size={20} /> แท้กสินค้า (Custom Tags)</p>
              <p className="text-xs text-[var(--text-muted)]">ตั้งค่าแท้กที่จะแสดงบนการ์ดสินค้า หากไม่ตั้งค่าจะใช้แท้กอัตโนมัติจาก options</p>
              <div className="flex flex-wrap gap-2">
                {((product.customTags || []) as Array<{ text: string; color: string; bgColor?: string }>).map((tag, idx) => (
                  <Badge
                    key={idx}
                    style={{ backgroundColor: tag.bgColor || `${tag.color}20`, color: tag.color, border: `1px solid ${tag.color}40` }}
                    className="gap-1"
                  >
                    {tag.text}
                    <button type="button" onClick={() => { const newTags = [...(product.customTags || [])]; newTags.splice(idx, 1); onChange({ ...product, customTags: newTags }); }} className="ml-1">×</button>
                  </Badge>
                ))}
                {(!product.customTags || product.customTags.length === 0) && (
                  <p className="text-xs italic text-[var(--text-muted)]">ยังไม่มีแท้ก (ใช้แท้กอัตโนมัติ)</p>
                )}
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[150px] flex-1 space-y-1.5">
                  <Label>ข้อความแท้ก</Label>
                  <Input className={inputClass} value={newTagText} onChange={(e) => setNewTagText(e.target.value)} placeholder="เช่น สินค้ามาใหม่" />
                </div>
                <div className="space-y-1.5">
                  <Label>สี</Label>
                  <Input type="color" className={cn(inputClass, 'w-20')} value={newTagColor} onChange={(e) => setNewTagColor(e.target.value)} />
                </div>
                <Button
                  size="sm"
                  className="bg-indigo-500"
                  onClick={() => {
                    if (!newTagText.trim()) return;
                    onChange({ ...product, customTags: [...(product.customTags || []), { text: newTagText.trim(), color: newTagColor, bgColor: `${newTagColor}20` }] });
                    setNewTagText('');
                  }}
                >
                  เพิ่ม
                </Button>
              </div>
              <div>
                <p className="mb-2 text-xs text-[var(--text-muted)]">แท้กยอดนิยม:</p>
                <div className="flex flex-wrap gap-1">
                  {[
                    { text: 'สินค้ามาใหม่', color: '#f59e0b' },
                    { text: 'ขายดี', color: '#ef4444' },
                    { text: 'Limited', color: '#8b5cf6' },
                    { text: 'Pre-order', color: '#3b82f6' },
                    { text: 'พร้อมส่ง', color: '#10b981' },
                  ].map((preset) => {
                    const isAdded = ((product.customTags || []) as Array<{ text: string }>).some((t) => t.text === preset.text);
                    return (
                      <Badge
                        key={preset.text}
                        variant="outline"
                        className={cn('cursor-pointer border-dashed', isAdded && 'opacity-50')}
                        style={{ color: preset.color, borderColor: `${preset.color}60` }}
                        onClick={() => {
                          if (isAdded) return;
                          onChange({ ...product, customTags: [...(product.customTags || []), { ...preset, bgColor: `${preset.color}20` }] });
                        }}
                      >
                        {preset.text}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={product.isActive} onCheckedChange={(checked) => onChange({ ...product, isActive: checked })} className="data-[state=checked]:bg-emerald-500" />
              <Label>{product.isActive ? 'Active' : 'Inactive'}</Label>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <p className="text-sm font-bold">Preview</p>
            <Card className={cn(glassCardClass, 'gap-0 overflow-hidden py-0')}>
              <div
                className="h-[180px] bg-cover bg-center"
                style={{
                  backgroundImage: product.coverImage || product.images?.[0]
                    ? `url(${product.coverImage || product.images?.[0]})`
                    : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                }}
              />
              <CardContent className="flex flex-col gap-2 px-4 py-4">
                <p className="font-bold">{product.name || 'ชื่อสินค้า'}</p>
                <p className="text-xs text-[var(--text-muted)]">{product.type}</p>
                <p className="text-lg font-bold text-emerald-500">฿{product.basePrice || 0}</p>
                <div className="flex flex-wrap gap-1">
                  {(product.images || []).slice(0, 3).map((img, idx) => (
                    <Badge key={img || idx} variant="secondary">รูป {idx + 1}</Badge>
                  ))}
                </div>
                {Object.keys(product.sizePricing || {}).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(product.sizePricing || {}).slice(0, 5).map(([size, raw]) => (
                      <Badge key={size} variant="secondary">{size}: ฿{Number(raw) || 0}</Badge>
                    ))}
                  </div>
                )}
                <Badge className={product.isActive ? 'bg-emerald-500' : ''}>{product.isActive ? 'Published' : 'Draft'}</Badge>
              </CardContent>
            </Card>
          </div>
        </div>

        <DialogFooter className="gap-2 border-t border-[var(--glass-border)] p-4">
          <Button variant="outline" onClick={onClose} className="border-[var(--glass-border)]">Cancel</Button>
          <Button variant="outline" onClick={() => onSave('draft')} disabled={isSaving} className="border-[var(--glass-border)]">
            {isSaving ? 'Saving...' : 'Save as Draft'}
          </Button>
          <Button onClick={() => onSave('publish')} disabled={isSaving} className={gradientBtnClass}>
            {isSaving ? 'Saving...' : 'Save & Publish'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
