<?php

/**
 * Advanced Sorting Helper
 * =======================
 * Sorts $items array with support for advanced criteria.
 */

declare(strict_types=1);

/**
 * Sort items array by the given sort key.
 * Folders always come before files unless explicitly sorting by files-only criteria.
 *
 * @param  array  $items  The items array from the main panel
 * @param  string  $sortKey  One of: newest, oldest, name_asc, name_desc, size_asc, size_desc, width, height
 * @param  string  $currentDir  Absolute path to current directory (for image dimension lookups)
 * @return array Sorted items
 */
function sorting_sort_items(array $items, string $sortKey, string $currentDir): array
{
    // For width/height: we need to read image dimensions
    if (in_array($sortKey, ['width', 'height'], true)) {
        foreach ($items as &$item) {
            if (! $item['is_dir'] && $item['is_image']) {
                $path = $currentDir.'/'.$item['name'];
                $info = @getimagesize($path);
                $item['img_width'] = $info ? (int) $info[0] : 0;
                $item['img_height'] = $info ? (int) $info[1] : 0;
            } else {
                $item['img_width'] = 0;
                $item['img_height'] = 0;
            }
        }
        unset($item);
    }

    usort($items, function ($a, $b) use ($sortKey) {
        // Folders-first rule (for most sorts, folders stay on top)
        $folderFirstSorts = ['name_asc', 'name_desc', 'newest', 'oldest', 'size_asc', 'size_desc'];
        if (in_array($sortKey, $folderFirstSorts, true) && $a['is_dir'] !== $b['is_dir']) {
            return $a['is_dir'] ? -1 : 1;
        }

        return match ($sortKey) {
            'newest' => ($b['mtime'] ?? 0) <=> ($a['mtime'] ?? 0),
            'oldest' => ($a['mtime'] ?? 0) <=> ($b['mtime'] ?? 0),
            'name_desc' => strcasecmp($b['name'] ?? '', $a['name'] ?? ''),
            'size_asc' => ($a['size'] ?? 0) <=> ($b['size'] ?? 0),
            'size_desc' => ($b['size'] ?? 0) <=> ($a['size'] ?? 0),
            'width' => ($b['img_width'] ?? 0) <=> ($a['img_width'] ?? 0),
            'height' => ($b['img_height'] ?? 0) <=> ($a['img_height'] ?? 0),
            default => strcasecmp($a['name'] ?? '', $b['name'] ?? ''), // name_asc + default
        };
    });

    return $items;
}

/**
 * Sort items so that pinned folders come first, then favorited folders, then rest.
 *
 * @param  array  $items  Sorted items
 * @param  array  $folderMeta  Metadata keyed by folder name (not full path)
 * @return array Re-sorted items
 */
function sorting_apply_folder_priority(array $items, array $folderMeta): array
{
    usort($items, function ($a, $b) use ($folderMeta) {
        $aDir = $a['is_dir'];
        $bDir = $b['is_dir'];

        // Files stay below all folders
        if ($aDir !== $bDir) {
            return $aDir ? -1 : 1;
        }
        if (! $aDir && ! $bDir) {
            return 0;
        } // both files — preserve relative sort

        // Both folders — apply priority
        $aMeta = $folderMeta[$a['name']] ?? [];
        $bMeta = $folderMeta[$b['name']] ?? [];

        $aPin = ! empty($aMeta['is_pinned']);
        $bPin = ! empty($bMeta['is_pinned']);
        $aFav = ! empty($aMeta['is_favorite']);
        $bFav = ! empty($bMeta['is_favorite']);

        if ($aPin !== $bPin) {
            return $aPin ? -1 : 1;
        }
        if ($aFav !== $bFav) {
            return $aFav ? -1 : 1;
        }

        return 0; // preserve previous sort for same priority
    });

    return $items;
}
