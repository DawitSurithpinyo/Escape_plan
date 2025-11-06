bundle:
	@head=$$(git log | head -n 1); \
	partialHash=$${head:7:10}; \
	mkdir -p bundles; \
	git bundle create ./bundles/"$$partialHash".bundle HEAD main;