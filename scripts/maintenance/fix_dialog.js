const fs = require('fs');
const path = 'src/components/ProductDetailsDialog.tsx';
let c = fs.readFileSync(path, 'utf8');
const badStr = `
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
c = c.split(badStr).join('\n                          </Box>');
fs.writeFileSync(path, c, 'utf8');
console.log('Fixed');
