import re

path = r'd:\shop\psusccshop\src\components\ProductDetailsDialog.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add Trash2
content = content.replace('Image as ImageOutlinedIcon,\n}', 'Image as ImageOutlinedIcon,\n  Trash2,\n}')

# 2. Add Props definition
props_target = 'config: ShopConfig;'
props_replacement = '''editingReviewId?: string | null;
  setEditingReviewId?: (id: string | null) => void;
  onEditReview?: (review: any) => void;
  onDeleteReview?: (id: string) => void;
  config: ShopConfig;'''
content = content.replace(props_target, props_replacement)

# 3. Add destructured props
destruct_target = 'config,\n}'
destruct_replacement = '''editingReviewId,
  setEditingReviewId,
  onEditReview,
  onDeleteReview,
  config,
}'''
content = content.replace(destruct_target, destruct_replacement)

# 4. Add Buttons to Review card
card_end = '''</Box>
                          </Box>'''

card_replacement = '''</Box>
                            {review.isOwner && (
                              <Box sx={{ display: 'flex', gap: 0.5, ml: 1 }}>
                                <IconButton size="small" onClick={() => onEditReview?.(review)} sx={{ p: 0.5 }}>
                                  <Edit size={14} color="var(--text-muted)" />
                                </IconButton>
                                <IconButton size="small" onClick={() => onDeleteReview?.(review.id)} sx={{ p: 0.5 }}>
                                  <Trash2 size={14} color="#ff453a" />
                                </IconButton>
                              </Box>
                            )}
                          </Box>'''

content = content.replace(card_end, card_replacement)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
