/** Recognize a published baseline that remains in main after later maintenance commits. */
export function isPromotedBaseline(release, comparison) {
  const source = release.target_commitish
  return /^[a-f0-9]{40}$/.test(source ?? '')
    && release.draft === false && release.prerelease === false
    && release.assets?.some(asset => asset.name === 'nulu-release.json') === true
    && comparison?.base_commit?.sha === source
    && comparison?.merge_base_commit?.sha === source
    && ['identical', 'ahead'].includes(comparison?.status)
}
