const fs = require('fs');

const path = 'src/components/ProductDetailsDialog.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add Trash2
content = content.replace('Image as ImageOutlinedIcon,\n}', 'Image as ImageOutlinedIcon,\n  Trash2,\n}');

// 2. Add Props definition
const propsTarget = 'config: ShopConfig;';
const propsReplacement = `editingReviewId?: string | null;
  setEditingReviewId?: (id: string | null) => void;
  onEditReview?: (review: any) => void;
  onDeleteReview?: (id: string) => void;
  config: ShopConfig;`;
content = content.replace(propsTarget, propsReplacement);

// 3. Add destructured props
const destructTarget = 'config,\n}';
const destructReplacement = `editingReviewId,
  setEditingReviewId,
  onEditReview,
  onDeleteReview,
  config,
}`;
content = content.replace(destructTarget, destructReplacement);

// 4. Add Buttons to Review card
const cardEnd = `</Box>
                          </Box>`;

const cardReplacement = `</Box>
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
                          </Box>`;

content = content.split(cardEnd).join(cardReplacement);

fs.writeFileSync(path, content, 'utf8');
console.log('Update complete');
