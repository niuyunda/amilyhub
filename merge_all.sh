for branch in feat-fix-data-linkage feat/agent-handover-and-api-catalog feat/backend-p0 feat/frontend-p0 feat/frontend-saas-redesign qa/integration-validation temp/main-clean-merge; do
  echo "Merging $branch..."
  git merge --no-edit "$branch" || { echo "Conflict detected when merging $branch! Aborting merge."; git merge --abort; exit 1; }
done
echo "All branches merged successfully!"
