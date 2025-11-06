bundle:
	@head=$$(git log | head -n 1); \
	partialHash=$${head:7:6}; \
	find . -name "*.bundle" -delete; \
	git bundle create "$$partialHash".bundle HEAD main;